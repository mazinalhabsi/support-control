<?php
/**
 * إعدادات خادم المزامنة (api.php) — الملف الوحيد الذي يُعدَّل عند النشر.
 *
 * القيم أدناه تناسب XAMPP كما يأتي افتراضياً (MySQL على الجهاز نفسه، حساب root بلا كلمة مرور).
 *
 * ⚠️ المستودع عام (public): لا تكتب كلمة المرور الحقيقية في هذا الملف داخل المستودع.
 *    على الخادم: عدّل القيم مباشرة في نسخة htdocs، أو أنشئ بجانبه ملف config.local.php
 *    (مُستثنى من git) يعيد المفاتيح التي تريد تغييرها فقط، مثلاً:
 *
 *      <?php
 *      return [
 *        'user' => 'sqapa',
 *        'password' => 'كلمة-مرور-قوية',
 *      ];
 *
 * الملفان محجوبان عن المتصفح عبر api/.htaccess، ويقرؤهما أيضاً tools/backup.php.
 */

return (static function (): array {
  $config = [
    /* اتصال قاعدة البيانات */
    'dsn' => '',                    // اتركه فارغاً لاستخدام القيم التالية (أو اكتب DSN كاملاً لـ PDO)
    'host' => '127.0.0.1',          // لا تكتب localhost: في Windows يحاول IPv6 أولاً فيتأخر كل طلب
    'port' => 3306,
    'database' => 'sqapa_it',       // تُنشأ تلقائياً عند أول تشغيل إن لم تكن موجودة
    'user' => 'root',               // الأفضل: مستخدم خاص بصلاحيات على هذه القاعدة فقط (انظر docs/XAMPP-TUNING.md)
    'password' => '',               // ضع كلمة المرور في config.local.php، لا هنا

    /* اتركه فارغاً ما دامت الواجهة وapi.php على الخادم نفسه. لا تكتب '*' أبداً */
    'allow_origin' => '',

    /* المرفقات: الحد الأقصى للملف الواحد بالميجابايت.
       يجب ألا يتجاوز upload_max_filesize و post_max_size في php.ini (40M في XAMPP افتراضياً) */
    'max_upload_mb' => 20,

    /* مجلد المرفقات: خارج htdocs حتى لا يُفتح من المتصفح مباشرة. يُنشأ تلقائياً عند أول رفع */
    'files_dir' => DIRECTORY_SEPARATOR === '\\' ? 'C:/xampp/sqapa_files' : '/var/lib/sqapa_files',
  ];

  /* الإعدادات الخاصة بهذا الخادم (كلمة المرور وغيرها) تُقرأ من ملف خارج المستودع إن وُجد */
  $local = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
  if (is_file($local)) {
    $override = require $local;
    if (is_array($override)) $config = array_replace($config, $override);
  }

  $config['port'] = (int) $config['port'];
  $config['max_upload_mb'] = max(1, (int) $config['max_upload_mb']);
  $config['password'] = (string) $config['password'];

  return $config;
})();
