#!/usr/bin/env python3
"""
يحوّل الملف الواحد src/index.html (4.6 ميجابايت) إلى نسخة نشر في dist/ يتحمّلها المتصفح مرة واحدة ثم يحفظها:

  dist/index.html                  صفحة صغيرة (بضعة كيلوبايت) تُطلب في كل فتح
  dist/assets/app.<hash>.js        كود النظام
  dist/assets/app.<hash>.css       التنسيقات
  dist/assets/fonts/*.woff2        الخطوط كملفات حقيقية (بدل base64 داخل CSS: أصغر بالثلث ولا تُحلَّل في كل فتح)
  dist/assets/forms/*.pdf          الاستمارات الرسمية، تُنزّل فقط عند الحاجة إليها (مرة واحدة لمن يدير النماذج)
  dist/assets/icon.png, manifest   الأيقونة وملف التطبيق
  dist/.htaccess                   ضغط وتخزين مؤقت طويل للملفات ذات البصمة (hash)
  dist/api/api.php                 خادم المزامنة (انسخ config.php بجانبه)

الاستخدام:  python3 tools/build.py   [المصدر]  [مجلد الإخراج]
"""
import base64, hashlib, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'src', 'index.html')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'dist')
API = os.path.join(os.path.dirname(SRC), 'api', 'api.php')

html = open(SRC, encoding='utf-8').read()
if os.path.isdir(os.path.join(OUT, 'assets')):
    shutil.rmtree(os.path.join(OUT, 'assets'))
os.makedirs(os.path.join(OUT, 'assets', 'fonts'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'assets', 'forms'), exist_ok=True)


def h8(data):
    return hashlib.sha256(data if isinstance(data, bytes) else data.encode('utf-8')).hexdigest()[:10]


def write(rel, data):
    path = os.path.join(OUT, rel)
    with open(path, 'wb') as f:
        f.write(data if isinstance(data, bytes) else data.encode('utf-8'))
    return rel


EXT = {'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'font/woff2': 'woff2', 'application/manifest+json': 'webmanifest'}
uris = {}


def extract_uri(mime, b64, folder='assets', prefix='a'):
    """data: URI -> ملف ببصمة؛ نفس المحتوى يُكتب مرة واحدة"""
    key = (mime, b64)
    if key not in uris:
        raw = base64.b64decode(b64)
        uris[key] = write(f'{folder}/{prefix}.{h8(raw)}.{EXT.get(mime, "bin")}', raw)
    return uris[key]


# 1) <head>: الأيقونات وملف التطبيق
head_end = html.index('</head>')
head = html[:head_end]
head = re.sub(r'href="data:(image/png|application/manifest\+json);base64,([A-Za-z0-9+/=]+)"',
              lambda m: f'href="{extract_uri(m.group(1), m.group(2), prefix="icon" if "png" in m.group(1) else "manifest")}"', head)

# 2) أنماط CSS: الخطوط إلى ملفات woff2، وكل التنسيقات في ملف واحد
styles = re.findall(r'<style>(.*?)</style>', head, re.S)
css = '\n'.join(styles)
css = re.sub(r'url\(data:font/woff2;base64,([A-Za-z0-9+/=]+)\)',
             lambda m: f'url({extract_uri("font/woff2", m.group(1), "assets/fonts", "f")[len("assets/"):]})', css)
css = re.sub(r'url\((["\']?)data:(image/(?:png|webp|jpeg));base64,([A-Za-z0-9+/=]{2000,})\1\)',
             lambda m: f'url({extract_uri(m.group(2), m.group(3))[len("assets/"):]})', css)
css_rel = write(f'assets/app.{h8(css)}.css', css)
head = re.sub(r'<style>.*?</style>\s*', '', head, flags=re.S)

# الخطان الأساسيان (عربي، وزن عادي) يبدأ تحميلهما مبكراً
fonts = re.findall(r"font-family: '([^']+)';[^}]*?font-weight: (\d+);[^}]*?src: url\((fonts/[^)]+)\)[^}]*?unicode-range: U\+0600", css, re.S)
preload = ''.join(f'<link rel="preload" href="assets/{u}" as="font" type="font/woff2" crossorigin>\n'
                  for fam, w, u in fonts if (fam, w) in {('IBM Plex Sans Arabic', '400'), ('IBM Plex Sans Arabic', '700')})
head += preload + f'<link rel="stylesheet" href="{css_rel}">\n'

# 3) <body>: الاستمارات إلى ملفات PDF، والكود إلى ملف JS
body = html[head_end:]
n_form = [0]


def form_repl(m):
    attrs, b64 = m.group(1), m.group(2).strip()
    n_form[0] += 1
    raw = base64.b64decode(b64)
    rel = write(f'assets/forms/form-{n_form[0]}.{h8(raw)}.pdf', raw)
    return f'<script{attrs} data-src="{rel}"></script>'


body = re.sub(r'<script(\s+type="application/octet-stream"\s+data-form[^>]*)>(.*?)</script>', form_repl, body, flags=re.S)

scripts = list(re.finditer(r'<script>(\(\(\)=>\{"use strict";.*?)</script>', body, re.S))
if len(scripts) != 1:
    sys.exit(f'expected exactly one app script, found {len(scripts)}')
js = scripts[0].group(1)
js_rel = write(f'assets/app.{h8(js)}.js', js)
body = body[:scripts[0].start()] + f'<script src="{js_rel}"></script>' + body[scripts[0].end():]

write('index.html', head + body)

# 4) إعدادات Apache: ضغط وتخزين مؤقت
write('.htaccess', """# ملفات assets تحمل بصمة (hash) في اسمها: تُحفظ في المتصفح سنة كاملة، وأي تحديث يغيّر اسمها تلقائياً
# index.html لا يُحفظ حتى يصل كل تحديث فوراً
AddType font/woff2 .woff2
AddType application/manifest+json .webmanifest

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript text/javascript application/json application/manifest+json image/svg+xml
</IfModule>

<IfModule mod_headers.c>
  <FilesMatch "\\.(js|css|woff2|png|webp|jpg|svg|pdf|webmanifest)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "^index\\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "same-origin"
  Header always set X-Frame-Options "SAMEORIGIN"
</IfModule>

Options -Indexes
""")

# 5) الخادم
if os.path.isfile(API):
    os.makedirs(os.path.join(OUT, 'api'), exist_ok=True)
    shutil.copyfile(API, os.path.join(OUT, 'api', 'api.php'))
    write('api/.htaccess', """# config.php يحوي كلمة مرور قاعدة البيانات: لا يُفتح من المتصفح
<Files "config.php">
  Require all denied
</Files>
Options -Indexes
""")

total = 0
for dp, _, fs in os.walk(OUT):
    for f in fs:
        total += os.path.getsize(os.path.join(dp, f))
print(f'source : {os.path.getsize(SRC) / 1048576:.2f} MB (single file)')
print(f'index  : {os.path.getsize(os.path.join(OUT, "index.html")) / 1024:.1f} KB')
print(f'js     : {len(js.encode()) / 1024:.0f} KB   css: {len(css.encode()) / 1024:.0f} KB   fonts: {len([k for k in uris if k[0] == "font/woff2"])}   forms: {n_form[0]}')
print(f'dist   : {total / 1048576:.2f} MB total on disk')
