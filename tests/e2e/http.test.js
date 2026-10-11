/* اختبار طرفي: النظام على http من عنوان غير آمن (مثل http://192.168.12.100/IT/)، وأيقونة التبويب وعدّاد الإشعارات.
   يُفتح الخادم باسم sqapa-http.test الموجَّه إلى عنوان BASE، فيعامله المتصفح كعنوان http غير آمن حتى لو كان الخادم على 127.0.0.1.
   التشغيل: BASE=http://127.0.0.1:8106/ CHROME=/path/to/chrome node tests/e2e/http.test.js */
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8106/', HOST = 'sqapa-http.test';
const u0 = new URL(BASE), U = BASE.replace(u0.hostname, HOST);
const res = []; const ok = (name, cond, info = '') => { res.push(`${cond ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: [`--host-resolver-rules=MAP ${HOST} ${u0.hostname}`] });
  const errs = [];
  const newPage = async () => {
    const c = await b.newContext({ viewport: { width: 1300, height: 860 }, acceptDownloads: true });
    await c.addInitScript(() => { try { localStorage.setItem('sq_motion', 'off'); } catch (_) {} document.addEventListener('DOMContentLoaded', () => { window.__favEarly = !!document.getElementById('sqFav'); }, { once: true }); });
    const p = await c.newPage(); p.setDefaultTimeout(20000);
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
    return p;
  };
  const login = async (p, u) => { await p.goto(U); await p.waitForSelector('[name="username"]'); await p.fill('[name="username"]', u); await p.fill('[name="password"]', 'Passw0rd!'); await p.keyboard.press('Enter'); await p.waitForFunction(() => window.App && App.Auth.user, null, { timeout: 20000 }); await p.waitForTimeout(1500); };
  const favState = (p) => p.evaluate(() => { const f = document.getElementById('sqFav'); return { fav: !!f, href: f ? f.getAttribute('href').slice(0, 22) : '', icons: [...document.querySelectorAll('link[rel="icon"]')].length, off: [...document.querySelectorAll('link[rel="sq-icon"]')].length, title: document.title, cache: localStorage.getItem('sq_favicon') ? 1 : 0 }; });
  const saveFav = (p, fav) => p.evaluate(async (fav) => { await App.Data.saveSettings({ favicon: fav }); }, fav);

  /* 1) عنوان http غير آمن: الدخول والتشفير يعملان دون crypto.subtle */
  const p = await newPage();
  await login(p, 'sup');
  const env = await p.evaluate(() => ({ secure: window.isSecureContext, subtle: !!(window.crypto && crypto.subtle), proto: location.protocol }));
  ok('opened as an insecure http origin', env.proto === 'http:' && env.secure === false && env.subtle === false, JSON.stringify(env));
  ok('login works on http without crypto.subtle', await p.evaluate(() => !!App.Auth.user));

  /* 2) الأيقونة: ثلاثة مقاسات، والشعار الرسمي مستقل عنها */
  const head = await p.evaluate(() => ({ sizes: [...document.querySelectorAll('link[rel="icon"]:not(#sqFav),link[rel="sq-icon"]')].map((l) => l.getAttribute('sizes')).sort().join(','), logo: (window.__ASSETS || {}).logo || '', icon: (document.querySelector('link[sizes="32x32"]') || {}).href || '' }));
  ok('tab icon in 16/32/48', head.sizes === '16x16,32x32,48x48', head.sizes);
  ok('official logo is separate from the tab icon', !!head.logo && head.logo !== head.icon && /logo|data:image\/png/.test(head.logo), head.logo.slice(-40));
  const files = await p.evaluate(async () => {
    const r = await fetch('favicon.ico'), m = document.querySelector('link[rel="manifest"]').href, isData = m.startsWith('data:');
    let start = '';
    if (!isData) { const j = await (await fetch(m)).json(); start = new URL(j.start_url, m).href; }
    return { ico: r.status, icoType: r.headers.get('content-type') || '', isData, start, root: location.href.split('#')[0] };
  });
  ok('favicon.ico served from the system folder', files.isData || files.ico === 200, `${files.ico} ${files.icoType}`);
  ok('desktop shortcut opens the system page (manifest start_url)', files.isData || files.start === files.root, `${files.start} vs ${files.root}`);

  /* 3) عدد الإشعارات غير المقروءة على الأيقونة وفي عنوان التبويب */
  await saveFav(p, { style: 'it', text: 'IT', bg: '#0B1628', fg: '#D9B45A', plate: 1, badge: 1, img: '' });
  await p.evaluate(async () => { await App.Data.notes.readAll(); }); await p.waitForTimeout(700);
  let f = await favState(p);
  ok('default icon without unread: static icons only', !f.fav && f.icons === 3 && !/^\(\d/.test(f.title), JSON.stringify(f));
  await p.evaluate(async () => { const me = App.Auth.user.id; for (let i = 0; i < 3; i++) await App.DB.put('notifications', { id: 'nt_http' + i + Date.now(), userId: me, at: Date.now(), read: 0, title: 'اختبار العداد ' + i, body: '', link: '/dashboard', kind: 'info' }); await App.Data.notes.remove([]); });
  await p.waitForTimeout(900); f = await favState(p);
  ok('unread count drawn on the icon', f.fav && f.href.startsWith('data:image/png') && f.off === 3, JSON.stringify(f));
  ok('unread count at the start of the tab title', /^\(3\) /.test(f.title), f.title);
  await p.evaluate(() => { location.hash = '#/tickets'; }); await p.waitForTimeout(1200);
  f = await favState(p);
  ok('count stays in the title after navigating', /^\(3\) /.test(f.title) && !/^\(3\) \(3\)/.test(f.title), f.title);
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  const tp = await p.evaluate(() => document.title);
  ok('no count in the title while printing (PDF file name)', !/^\(\d/.test(tp), tp);
  await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(800);
  ok('count returns after printing', /^\(3\) /.test(await p.evaluate(() => document.title)));
  await saveFav(p, { style: 'it', text: 'IT', bg: '#0B1628', fg: '#D9B45A', plate: 1, badge: 0, img: '' }); await p.waitForTimeout(700);
  f = await favState(p);
  ok('badge can be switched off', !f.fav && !/^\(\d/.test(f.title), JSON.stringify(f));
  await saveFav(p, { style: 'it', text: 'IT', bg: '#0B1628', fg: '#D9B45A', plate: 1, badge: 1, img: '' });
  await p.evaluate(async () => { await App.Data.notes.readAll(); }); await p.waitForTimeout(800);
  f = await favState(p);
  ok('reading all clears icon badge and title count', !f.fav && f.icons === 3 && !/^\(\d/.test(f.title), JSON.stringify(f));

  /* 4) صفحة «أيقونة المتصفح» في الإعدادات */
  await p.evaluate(() => { location.hash = '#/settings?s=favicon'; }); await p.waitForSelector('.fv-style'); await p.waitForTimeout(900);
  const opts = await p.evaluate(() => ({ n: document.querySelectorAll('.fv-style').length, painted: [...document.querySelectorAll('[data-fvs],[data-fvp]')].every((cv) => { const x = cv.getContext('2d'), d = x.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }), on: (document.querySelector('.fv-style.on input') || {}).value }));
  ok('five icon styles with live previews', opts.n === 5 && opts.painted && opts.on === 'it', JSON.stringify(opts));
  await p.click('.fv-style:has(input[value="headset"])'); await p.click('[data-sw^="#0F5132"]'); await p.waitForTimeout(400);
  await p.click('[data-act="fvsave"]'); await p.waitForTimeout(1500);
  const saved = await p.evaluate(() => App.Data.c.settings.favicon || {}); f = await favState(p);
  ok('headset in green saved to settings', saved.style === 'headset' && saved.bg === '#0F5132' && saved.fg === '#FFFFFF', JSON.stringify(saved));
  ok('tab shows the chosen icon and keeps it for the next visit', f.fav && f.cache === 1 && f.off === 3, JSON.stringify(f));
  await p.reload({ waitUntil: 'domcontentloaded' });
  const early = await p.evaluate(() => ({ early: window.__favEarly === true }));
  ok('chosen icon appears before the system finishes loading', early.early, JSON.stringify(early));
  await p.waitForFunction(() => window.App && App.Auth.user); await p.waitForTimeout(1500);

  /* جهاز آخر يتلقى الأيقونة من الخادم */
  const q = await newPage(); await login(q, 'tech'); await q.waitForTimeout(1500);
  const other = await q.evaluate(() => ({ style: (App.Data.c.settings.favicon || {}).style, fav: !!document.getElementById('sqFav') }));
  ok('other devices get the icon through sync', other.style === 'headset' && other.fav, JSON.stringify(other));
  await q.context().close();

  /* حروف عربية، ثم صورة مخصصة */
  await p.evaluate(() => { location.hash = '#/settings?s=favicon'; }); await p.waitForSelector('.fv-style'); await p.waitForTimeout(600);
  await p.click('.fv-style:has(input[value="text"])'); await p.fill('[name="fvtext"]', 'دعم'); await p.click('[data-act="fvsave"]'); await p.waitForTimeout(1200);
  ok('custom letters saved', await p.evaluate(() => { const v = App.Data.c.settings.favicon || {}; return v.style === 'text' && v.text === 'دعم'; }));
  const png = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 60; const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0, 0, 120, 60); x.fillStyle = '#fff'; x.fillRect(40, 15, 40, 30); return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  const tmp = require('os').tmpdir() + '/sq-fav-test.png'; fs.writeFileSync(tmp, png);
  await p.click('.fv-style:has(input[value="custom"])');
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-act="fvimg"]')]); await chooser.setFiles(tmp); await p.waitForTimeout(800);
  await p.click('[data-act="fvsave"]'); await p.waitForTimeout(1200);
  const cu = await p.evaluate(() => { const v = App.Data.c.settings.favicon || {}; return { style: v.style, len: (v.img || '').length, fav: !!document.getElementById('sqFav') }; });
  ok('custom image saved small and applied', cu.style === 'custom' && cu.len > 50 && cu.len < 60000 && cu.fav, JSON.stringify(cu));
  await p.click('[data-act="fvreset"]'); await p.click('[data-act="fvsave"]'); await p.waitForTimeout(1200);
  f = await favState(p);
  ok('default restored: static icons back, cache cleared', !f.fav && f.icons === 3 && f.off === 0 && f.cache === 0, JSON.stringify(f));

  /* 5) صفحة «العمل على http» وملف السياسة */
  await p.evaluate(() => { location.hash = '#/settings?s=http'; }); await p.waitForSelector('.hp-feats'); await p.waitForTimeout(500);
  const hp = await p.evaluate(() => ({ banner: document.querySelector('.hp-state').className, text: document.querySelector('.hp-state b').textContent, cam: [...document.querySelectorAll('.hp-f')].find((x) => /الكاميرا: تصوير/.test(x.textContent)).className, origins: document.querySelector('[name="origins"]').value }));
  ok('http page reports the insecure origin', /tone-amber/.test(hp.banner) && /غير آمن/.test(hp.text), hp.text);
  ok('camera listed as blocked on http', /off/.test(hp.cam), hp.cam);
  ok('current address prefilled', hp.origins.split('\n')[0] === new URL(U).origin, hp.origins);
  await p.fill('[name="origins"]', 'ftp://bad'); await p.click('[data-act="hpreg"]'); await p.waitForTimeout(500);
  ok('invalid address rejected', /غير صالح/.test(await p.$$eval('.toast', (x) => x.map((t) => t.textContent).join(' '))));
  await p.fill('[name="origins"]', 'it\nhttp://192.168.12.100/IT/\nhttp://it');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="hpreg"]')]);
  const regPath = await dl.path(), raw = fs.readFileSync(regPath), txt = raw.slice(2).toString('utf16le');
  ok('policy file is UTF-16 with BOM (regedit format)', raw[0] === 0xff && raw[1] === 0xfe && txt.startsWith('Windows Registry Editor Version 5.00\r\n'), dl.suggestedFilename());
  ok('policy file lists Chrome and Edge keys with both addresses', /\[HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\OverrideSecurityRestrictionsOnInsecureOrigin\]\r\n"1"="http:\/\/it"\r\n"2"="http:\/\/192\.168\.12\.100"\r\n/.test(txt) && /Microsoft\\Edge\\OverrideSecurityRestrictionsOnInsecureOrigin\]\r\n"1"="http:\/\/it"/.test(txt) && !/"3"=/.test(txt), JSON.stringify(txt.slice(0, 400)));
  ok('policy file also lets display screens play sound without a tap', /Google\\Chrome\\AutoplayAllowlist\]\r\n"1"="http:\/\/it"\r\n"2"="http:\/\/192\.168\.12\.100"/.test(txt) && /Microsoft\\Edge\\AutoplayAllowlist\]\r\n"1"="http:\/\/it"/.test(txt));
  await p.waitForTimeout(800);
  ok('addresses remembered in settings', JSON.stringify(await p.evaluate(() => App.Data.c.settings.httpOrigins)) === JSON.stringify(['http://it', 'http://192.168.12.100']));
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-act="hpunreg"]')]);
  const t2 = fs.readFileSync(await dl2.path()).slice(2).toString('utf16le');
  ok('removal file only deletes the keys', /\[-HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\OverrideSecurityRestrictionsOnInsecureOrigin\]/.test(t2) && !/"1"=/.test(t2));

  /* 6) الميزات الممنوعة على http تشرح السبب، والنسخ يعمل بالطريقة البديلة */
  await p.evaluate(() => { App.Pages.scanModal(); }); await p.waitForSelector('.scan-off'); await p.waitForTimeout(300);
  ok('camera scan explains the http block', /لا تعمل على http/.test(await p.textContent('.scan-off')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  /* زر «نسخ» داخل نافذة مفتوحة (مثل نافذة بيانات الحسابات الجديدة) */
  await p.evaluate(() => { App.UI.modal({ title: 'نسخ', body: '<p>اختبار</p>', actions: [{ label: 'نسخ', kind: 'primary', handler: async () => { window.__cp = await App.copyText('اختبار النسخ'); return false; } }, { label: 'إغلاق', kind: 'ghost', value: null }] }); });
  await p.waitForSelector('dialog[open] .btn-primary'); await p.click('dialog[open] .btn-primary'); await p.waitForTimeout(400);
  ok('copy works on http inside an open dialog', await p.evaluate(() => window.__cp === true), String(await p.evaluate(() => window.__cp)));
  await p.keyboard.press('Escape');
  ok('no page errors during the http run', !errs.length, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n'));
  await b.close();
})().catch((e) => { console.log(res.join('\n')); console.log('CRASH', e.stack); process.exit(1); });
