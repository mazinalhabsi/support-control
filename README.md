# support-control

نظام قسم تقنية المعلومات — البلاغات، المخازن والعهد، الصيانة، الملاحظات، والهيكل التنظيمي.

- الواجهة: `index.html` و`assets/` (ملفات جاهزة للنشر، تعمل من مجلد htdocs في XAMPP).
- الخادم: `api/api.php` مع MySQL. الإعدادات في `api/config.php`، وكلمة المرور الحقيقية في `api/config.local.php` (خارج المستودع).
- بعد أي تعديل على `assets/app.*.js` أو `assets/app.*.css` شغّل `node tools/rehash.js` ليأخذ الملف اسماً جديداً ويصل التحديث كل الأجهزة
  (الملفات تُحفظ في المتصفح سنة كاملة).

انظر [CHANGELOG.md](CHANGELOG.md) لتفاصيل كل إصدار.
