# تجهيز خادم XAMPP لمئات المستخدمين في الوقت نفسه

الكود صار خفيفاً على الخادم، لكن إعدادات XAMPP الافتراضية مصممة لجهاز مطوّر واحد. هذه الإعدادات تُضبط **مرة واحدة**، وكل خطوة فيها تعديل سطر أو سطرين.

> قبل أي تعديل: خذ نسخة من الملفات الثلاثة (`httpd.conf` و`php.ini` و`my.ini`). بعد التعديل أعد تشغيل Apache وMySQL من XAMPP Control Panel.
>
> للتحقق: سجّل الدخول بحساب المشرف، ثم افتح زر قاعدة البيانات في الأعلى، نافذة «المزامنة والخادم»، قسم «صحة الخادم». كل بند فيه علامة ✓ أو ⚠ مع طريقة الإصلاح.

---

## 1. Apache — `C:\xampp\apache\conf\httpd.conf`

احذف علامة `#` من بداية هذه الأسطر:

```
LoadModule deflate_module modules/mod_deflate.so
LoadModule headers_module modules/mod_headers.so
```

وتأكد أن مجلد htdocs يسمح بملف `.htaccess`:

```
<Directory "C:/xampp/htdocs">
    AllowOverride All
```

في نهاية الملف أضف:

```
ServerName localhost
KeepAlive On
MaxKeepAliveRequests 500
KeepAliveTimeout 5
```

## 2. عدد الطلبات المتزامنة — `C:\xampp\apache\conf\extra\httpd-mpm.conf`

في قسم `mpm_winnt_module`:

```
<IfModule mpm_winnt_module>
    ThreadsPerChild        400
    MaxConnectionsPerChild   0
</IfModule>
```

القيمة الافتراضية 150 تكفي نحو 150 طلباً في اللحظة نفسها. القيمة 400 تكفي مئات المستخدمين بهامش أمان.

## 3. PHP — `C:\xampp\php\php.ini`

تفعيل OPcache يُغني PHP عن إعادة قراءة الكود في كل طلب:

```
zend_extension=opcache
opcache.enable=1
opcache.memory_consumption=128
opcache.max_accelerated_files=4000
opcache.validate_timestamps=1
opcache.revalidate_freq=60

realpath_cache_size=4096k
realpath_cache_ttl=600
memory_limit=256M
post_max_size=64M
upload_max_filesize=32M
```

## 4. MySQL / MariaDB — `C:\xampp\mysql\bin\my.ini`

في قسم `[mysqld]`:

```
max_connections=500
max_allowed_packet=64M
innodb_buffer_pool_size=512M
innodb_log_file_size=128M
skip-name-resolve
innodb_flush_log_at_trx_commit=2
```

- **`skip-name-resolve`**: يمنع البحث في DNS عن اسم كل جهاز يتصل، وهذا سبب شائع لبطء الاتصال في الشبكات المؤسسية. بعد تفعيله استخدم `127.0.0.1` وليس `localhost` في صلاحيات مستخدم MySQL.
- **`innodb_buffer_pool_size`**: اجعلها نحو ربع ذاكرة الخادم (512M لخادم 4 جيجابايت، و1G لخادم 8 جيجابايت).
- **`innodb_flush_log_at_trx_commit=2`**: تسرّع الحفظ كثيراً، خاصة على القرص التقليدي (HDD). الثمن: قد تضيع آخر ثانية من التعديلات إذا انقطعت الكهرباء عن الخادم فجأة (وليس عند إعادة تشغيل MySQL). إذا لم يكن ذلك مقبولاً فاترك القيمة 1.

## 5. ملف `config.php`

```php
'host' => '127.0.0.1',
```

في Windows يحاول `localhost` الاتصال عبر IPv6 أولاً، فيتأخر كل طلب. الكود يحوّلها تلقائياً، لكن كتابتها صراحة أوضح.

## 6. مكافح الفيروسات في Windows

أضف المجلد `C:\xampp` إلى استثناءات Windows Defender (أو برنامج الحماية المستخدم). بدون ذلك يُفحص كل ملف PHP وملف قاعدة بيانات مع كل طلب. هذا من أكثر أسباب بطء XAMPP شيوعاً.

## 7. الخادم نفسه

- يُفضَّل قرص SSD، ومعالج بأربعة أنوية وذاكرة 8 جيجابايت أو أكثر.
- لا تشغّل الخادم على جهاز يستخدمه أحد للعمل اليومي.
- اجعل MySQL وApache يعملان كخدمات Windows (زر Svc في XAMPP Control Panel)، حتى يعملا تلقائياً بعد إعادة التشغيل.

---

## 8. العمل على http و https معاً

النظام لا يفرض بروتوكولاً معيناً: يعمل على `http://` و`https://` في الوقت نفسه بلا أي تعديل في ملفاته. ويختار عنوان الخادم حسب الصفحة المفتوحة، ويصحح تلقائياً أي عنوان قديم محفوظ ببروتوكول آخر. يبقى فقط تفعيل https في Apache:

1. **تأكد أن SSL مفعّل** (مفعّل افتراضياً في XAMPP). في `C:\xampp\apache\conf\httpd.conf` يجب ألا تبدأ هذه الأسطر بعلامة `#`:
   ```
   LoadModule ssl_module modules/mod_ssl.so
   Include conf/extra/httpd-ssl.conf
   ```
2. **أنشئ شهادة باسم الخادم وعنوانه.** المتصفحات الحديثة ترفض الشهادة التي لا تحتوي حقل `subjectAltName`. من موجه الأوامر:
   ```
   cd C:\xampp\apache
   bin\openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -config conf\openssl.cnf ^
     -keyout conf\ssl.key\server.key -out conf\ssl.crt\server.crt ^
     -subj "/CN=sqapa-server" -addext "subjectAltName=DNS:sqapa-server,IP:192.168.1.10"
   ```
   ضع اسم الخادم الفعلي وعنوان IP الخاص به بدل `sqapa-server` و`192.168.1.10`. الملفان يحلان محل شهادة XAMPP الافتراضية، فلا يلزم تعديل `httpd-ssl.conf`.
3. **أعد تشغيل Apache** من لوحة XAMPP، وافتح المنفذ 443 في جدار حماية Windows للشبكة الداخلية.
4. **اجعل الأجهزة تثق بالشهادة** حتى لا تظهر رسالة «الاتصال ليس خاصاً»:
   - **الأفضل:** يوزّع قسم الأنظمة الملف `server.crt` عبر Group Policy إلى «Trusted Root Certification Authorities».
   - **يدوياً على جهاز واحد:** انقر الملف نقراً مزدوجاً ← Install Certificate ← Local Machine ← «Trusted Root Certification Authorities».
   - إن كان لدى الأكاديمية جهة شهادات داخلية (Active Directory Certificate Services)، فاطلب منها شهادة للخادم، وتثق بها كل الأجهزة تلقائياً.
5. **جرّب:** `http://sqapa-server/IT/` و`https://sqapa-server/IT/`، فيجب أن يعمل الاثنان.

ملاحظات:
- المتصفح يعامل `http` و`https` كموقعين منفصلين. لذلك يسجّل المستخدم دخوله في كل منهما مرة، ويحتفظ المتصفح بنسخة محلية لكل منهما، لكن البيانات واحدة على الخادم.
- على `http` يستخدم النظام تشفيره الداخلي لكلمات المرور، لأن المتصفح لا يتيح أدوات التشفير الحديثة إلا على `https`. ويعمل النسخ إلى الحافظة بطريقة بديلة.
- لا يوجد تحويل إجباري من http إلى https. إن قررتم لاحقاً اعتماد https وحده بعد تثبيت الشهادة على كل الأجهزة، فأضيفوا التحويل في `.htaccess`.

## 9. نسخ Chrome القديمة

النظام يعمل من **Chrome 60** فما فوق:
- أُضيفت بدائل للدوال الحديثة التي لا تعرفها النسخ القديمة.
- حُوّلت قاعدة البيانات الاحتياطية في الذاكرة لتعمل عليها.
- أُضيفت بدائل لتنسيقات المواضع الحديثة، حتى لا تختل النوافذ قبل Chrome 87.

إن ظهرت رسالة «التحميل يستغرق وقتاً أطول من المعتاد»، ففي آخرها سطر صغير بالإنجليزية فيه نسخة المتصفح وسبب التعطل الفعلي. صوّره وأرسله للدعم. ويُنصح دائماً بتحديث Chrome من `chrome://settings/help`.

## ما تم قياسه

الاختبار على Apache وPHP 8.3 وMariaDB 10.11 بقاعدة فيها 70,457 سجلاً (431 مستخدماً، 8,000 بلاغ، 24,000 حدث، 20,000 سجل نشاط، 3,000 جهاز):

| | النتيجة |
|---|---|
| المستخدمون في الوقت نفسه | 400 موظف + 30 فنياً، دخلوا كلهم خلال دقيقة واحدة |
| الأخطاء | **0** من 18,747 طلباً |
| سحب التحديثات (الطلب الأكثر تكراراً) | 28ms في المعتاد، و95% من الطلبات أقل من 153ms |
| الحفظ | 5ms في المعتاد |
| أول دخول للموظف على جهاز جديد | 358 كيلوبايت (كان 15.9 ميجابايت لكل موظف) |
| أعلى عدد اتصالات بقاعدة البيانات | 57 من 500 |
