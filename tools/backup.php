<?php
/**
 * نسخة احتياطية كاملة على الخادم نفسه: قاعدة البيانات ومجلد المرفقات في ملف مؤرخ، مع حذف النسخ الأقدم من المدة المحددة.
 * لا تعتمد على متصفح مفتوح، وتُجدول يومياً من «جدولة المهام» في Windows (الشرح في docs/XAMPP-TUNING.md).
 *
 * التشغيل:
 *   C:\xampp\php\php.exe C:\xampp\sqapa-tools\backup.php C:\xampp\htdocs\IT\api\config.php D:\IT-Backups 30
 *   (المعاملات: مسار config.php، مجلد النسخ، عدد الأيام التي تُحفظ فيها النسخ)
 *
 * الاسترجاع:
 *   1. فك ضغط النسخة.
 *   2. C:\xampp\mysql\bin\mysql.exe -u root -p اسم_القاعدة < db.sql   (بعد فك db.sql.gz)
 *   3. انسخ مجلد files إلى مكانه (files_dir في config.php).
 */
declare(strict_types=1);
error_reporting(E_ALL);
date_default_timezone_set(@date_default_timezone_get() ?: 'Asia/Muscat');

$cfgPath = $argv[1] ?? '';
$dest = rtrim($argv[2] ?? '', '/\\');
$keepDays = max(1, (int) ($argv[3] ?? 30));
if ($cfgPath === '' || $dest === '' || !is_file($cfgPath)) {
  fwrite(STDERR, "Usage: php backup.php <path-to-api/config.php> <backup-folder> [days-to-keep]\n");
  exit(2);
}
$cfg = require $cfgPath;
if (!is_array($cfg)) { fwrite(STDERR, "config.php did not return settings\n"); exit(2); }
if (!is_dir($dest) && !@mkdir($dest, 0775, true)) { fwrite(STDERR, "Cannot create $dest\n"); exit(2); }

$stamp = date('Y-m-d_Hi');
$work = "$dest/sqapa_$stamp";
$log = function (string $msg) use ($dest): void { @file_put_contents("$dest/backup.log", date('Y-m-d H:i:s') . " $msg\n", FILE_APPEND); echo "$msg\n"; };
@mkdir($work, 0775, true);

/* 1) قاعدة البيانات عبر mysqldump، وبيانات الدخول في ملف مؤقت لا تظهر في قائمة العمليات */
$host = strtolower((string) ($cfg['host'] ?? '127.0.0.1')) === 'localhost' ? '127.0.0.1' : (string) ($cfg['host'] ?? '127.0.0.1');
$candidates = [getenv('MYSQLDUMP') ?: '', 'C:\\xampp\\mysql\\bin\\mysqldump.exe', dirname(PHP_BINARY) . '\\..\\mysql\\bin\\mysqldump.exe', 'mysqldump'];
$dump = 'mysqldump';
foreach ($candidates as $c) { if ($c !== '' && ($c === 'mysqldump' || is_file($c))) { $dump = $c; break; } }
$cnf = tempnam(sys_get_temp_dir(), 'sqb');
file_put_contents($cnf, "[client]\nuser=\"" . addcslashes((string) ($cfg['user'] ?? 'root'), '"\\') . "\"\npassword=\"" . addcslashes((string) ($cfg['password'] ?? ''), '"\\') . "\"\nhost=$host\nport=" . (int) ($cfg['port'] ?? 3306) . "\n");
$sqlFile = "$work/db.sql";
$cmd = escapeshellarg($dump) . ' --defaults-extra-file=' . escapeshellarg($cnf) . ' --single-transaction --quick --default-character-set=utf8mb4 --routines '
  . escapeshellarg((string) ($cfg['database'] ?? 'sqapa')) . ' > ' . escapeshellarg($sqlFile) . ' 2> ' . escapeshellarg("$work/dump-errors.txt");
exec($cmd, $o, $rc);
@unlink($cnf);
if ($rc !== 0 || !is_file($sqlFile) || filesize($sqlFile) < 100) {
  $err = @file_get_contents("$work/dump-errors.txt") ?: "exit code $rc";
  $log("FAILED database dump: " . trim($err));
  exit(1);
}
@unlink("$work/dump-errors.txt");
/* ضغط الملف (zlib مدمج في PHP دائماً) */
$in = fopen($sqlFile, 'rb'); $gz = gzopen("$sqlFile.gz", 'wb6');
while (!feof($in)) gzwrite($gz, (string) fread($in, 1 << 20));
fclose($in); gzclose($gz); @unlink($sqlFile);

/* 2) مجلد المرفقات */
$files = rtrim((string) ($cfg['files_dir'] ?? ''), '/\\');
$copied = 0;
if ($files !== '' && is_dir($files)) {
  $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($files, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
  foreach ($it as $f) {
    $rel = substr($f->getPathname(), strlen($files) + 1);
    $target = "$work/files/$rel";
    if ($f->isDir()) { @mkdir($target, 0775, true); continue; }
    @mkdir(dirname($target), 0775, true);
    if (@copy($f->getPathname(), $target)) $copied++;
  }
}

/* 3) ملف واحد مضغوط إن توفرت إضافة zip، وإلا يبقى مجلداً */
$final = $work;
if (class_exists('ZipArchive')) {
  $zip = new ZipArchive();
  if ($zip->open("$work.zip", ZipArchive::CREATE | ZipArchive::OVERWRITE) === true) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($work, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) $zip->addFile($f->getPathname(), substr($f->getPathname(), strlen($work) + 1));
    $zip->close();
    $rm = function (string $d) use (&$rm): void { foreach (scandir($d) ?: [] as $x) { if ($x === '.' || $x === '..') continue; $p = "$d/$x"; is_dir($p) ? $rm($p) : @unlink($p); } @rmdir($d); };
    $rm($work); $final = "$work.zip";
  }
}

/* 4) حذف النسخ الأقدم من المدة المحددة */
$removed = 0;
foreach (glob("$dest/sqapa_*") ?: [] as $old) {
  if ($old === $final || filemtime($old) > time() - $keepDays * 86400) continue;
  if (is_dir($old)) { $rm = function (string $d) use (&$rm): void { foreach (scandir($d) ?: [] as $x) { if ($x === '.' || $x === '..') continue; $p = "$d/$x"; is_dir($p) ? $rm($p) : @unlink($p); } @rmdir($d); }; $rm($old); }
  else @unlink($old);
  $removed++;
}
$size = is_file($final) ? filesize($final) : 0;
$log('OK ' . basename($final) . ($size ? ' (' . round($size / 1048576, 1) . ' MB)' : '') . " — attachments: $copied, removed old: $removed");
exit(0);
