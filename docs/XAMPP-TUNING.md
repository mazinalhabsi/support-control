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
