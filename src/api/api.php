<?php
/**
 * نظام الدعم الفني والمخازن — خادم المزامنة
 * يعمل على XAMPP (Apache + PHP + MySQL) دون أي إضافات.
 * الملف الوحيد الذي تحتاج تعديله هو config.php
 *
 * تحديث 2026-09: صلاحيات مطابقة للواجهة على الخادم، تغيير المستخدم كلمة مروره وملفه الشخصي،
 * عدم توقف المزامنة بسبب ملف أكبر من max_allowed_packet، إنشاء قاعدة البيانات تلقائياً،
 * وحماية مجلد المرفقات من الفتح المباشر.
 *
 * تحديث 2026-10 (الأداء والأمان):
 *  - التواجد (presence) في جدول مستقل عبر beat ولا يرفع رقم التغيير، فلا تسحبه كل الأجهزة كل بضع ثوانٍ.
 *  - lease: حجز ذري لمهام الصيانة الدورية حتى ينفذها جهاز واحد فقط.
 *  - pull: إصلاح فقدان سجلات حين تتجاوز دفعة واحدة (نفس رقم التغيير) حد الصفحة.
 *  - file: منع تنفيذ ملفات HTML/SVG المرفوعة داخل النظام (XSS)، وتخزين المرفقات مؤقتاً في المتصفح.
 *  - upload: لا يُستبدل ملف موجود برقم معرّف مكرر.
 *  - عدم كشف تفاصيل الأخطاء الداخلية للمتصفح، وتصفير عداد المحاولات الخاطئة بعد الدخول الناجح.
 *
 * تحديث 2026-10 (مئات المستخدمين في الوقت نفسه):
 *  - الموظف يستلم في المزامنة بياناته فقط (بلاغاته، إشعاراته، استفساراته، عهده) والقوائم المشتركة،
 *    بدل نسخة كاملة من قاعدة البيانات لكل جهاز.
 *  - localhost يُستبدل بـ 127.0.0.1 (في Windows يحاول IPv6 أولاً فيتأخر كل اتصال).
 *  - جدولا التواجد والحجوزات في الذاكرة (MEMORY) بلا كتابة على القرص.
 *  - ping خفيف، وإجراء diag للمشرف يقيس سرعة الخادم ويعرض الإعدادات الناقصة.
 *
 * تحديث 2026-10 (الاستبيانات والتقييم والردود الجاهزة):
 *  - الاستبيانات يديرها من يملك surveys.manage، ولا يُقبل رد إلا على استبيان منشور ضمن مدته وجمهوره.
 *  - رد واحد لكل مستخدم، ويُسجّل الخادم بنفسه أن المستخدم شارك (حتى في الاستبيان مجهول الهوية).
 *  - لا يرى أحد ردود غيره إلا من يدير الاستبيانات. svstats: نِسب مجمّعة للمشارك إن سُمح بها.
 *  - الردود الجاهزة العامة يعدّلها من يملك replies.manage، والخاصة لصاحبها فقط.
 */
declare(strict_types=1);
@ini_set('display_errors', '0');
error_reporting(E_ALL);
if (function_exists('mb_internal_encoding')) mb_internal_encoding('UTF-8');
function lc(string $s): string { return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s); }
function cut(string $s, int $n): string { return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n); }

$CONFIG = require __DIR__ . '/config.php';

/* ضغط الردود (JSON يصغر 5 إلى 10 مرات) — لا يُطبق على تنزيل الملفات */
if (($_GET['a'] ?? '') !== 'file' && function_exists('ob_gzhandler') && !ini_get('zlib.output_compression')) @ob_start('ob_gzhandler');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
if (!empty($CONFIG['allow_origin'])) {
  header('Access-Control-Allow-Origin: ' . $CONFIG['allow_origin']);
  header('Access-Control-Allow-Headers: Content-Type, X-Token');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

set_exception_handler(function (Throwable $e): void {
  /* التفاصيل في سجل أخطاء Apache/PHP فقط، لا تُرسل للمتصفح */
  error_log('sqapa api: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
  echo json_encode(['error' => 'خطأ في الخادم، راجع سجل الأخطاء'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
});

function out($data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function fail(string $msg, int $code = 400): void { out(['error' => $msg], $code); }
function body(): array { $raw = file_get_contents('php://input'); if ($raw === '' || $raw === false) return []; $j = json_decode($raw, true); return is_array($j) ? $j : []; }
function now_ms(): int { return (int) round(microtime(true) * 1000); }
const DAY_MS = 86400000;

function db(): PDO {
  global $CONFIG; static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  /* في Windows يُترجم localhost إلى IPv6 أولاً ثم يعود إلى IPv4، فيتأخر كل اتصال (قد يصل إلى ثانية كاملة لكل طلب) */
  $host = strtolower((string) $CONFIG['host']) === 'localhost' ? '127.0.0.1' : (string) $CONFIG['host'];
  $dsn = $CONFIG['dsn'] ?: sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $host, $CONFIG['port'], $CONFIG['database']);
  $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
  try {
    $pdo = new PDO($dsn, $CONFIG['user'], $CONFIG['password'], $opts);
  } catch (PDOException $e) {
    /* قاعدة البيانات غير موجودة بعد: تُنشأ تلقائياً في أول تشغيل */
    if (empty($CONFIG['dsn']) && (int) ($e->errorInfo[1] ?? 0) === 1049) {
      try {
        $root = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $host, $CONFIG['port']), $CONFIG['user'], $CONFIG['password'], $opts);
        $root->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', $CONFIG['database']) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo = new PDO($dsn, $CONFIG['user'], $CONFIG['password'], $opts);
      } catch (Throwable $e2) { fail('تعذر إنشاء قاعدة البيانات: ' . $e2->getMessage(), 500); }
    } else fail('تعذر الاتصال بقاعدة البيانات: ' . $e->getMessage(), 500);
  }
  $pdo->exec("SET SESSION sql_mode='STRICT_ALL_TABLES'");
  return $pdo;
}

/** أقصى حجم لسجل واحد تقبله MySQL (إعداد max_allowed_packet، وقيمته في XAMPP الافتراضي 1 ميجابايت فقط) */
function max_doc_bytes(): int {
  static $n = null;
  if ($n === null) { $n = (int) db()->query('SELECT @@max_allowed_packet')->fetchColumn(); }
  return max(200000, $n - 65536);
}

function setup(): void {
  /* الفحص الكامل مرة كل 10 دقائق فقط، لا مع كل طلب */
  $flag = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'sqapa_setup_' . md5(__FILE__);
  /* العلامة تحمل رقم إصدار الجداول: ترقية الملف تُنشئ الجداول الجديدة فوراً دون انتظار انتهاء المدة */
  if (is_file($flag) && time() - filemtime($flag) < 600 && @file_get_contents($flag) === 'v5') return;
  $pdo = db();
  /* رفع الحدود تلقائياً إن سمحت صلاحيات المستخدم (حساب root في XAMPP يسمح). تسري حتى إعادة تشغيل MySQL */
  try { if ((int) $pdo->query('SELECT @@global.max_allowed_packet')->fetchColumn() < 67108864) $pdo->exec('SET GLOBAL max_allowed_packet = 67108864'); } catch (Throwable $e) { /* يلزم تعديل my.ini يدوياً */ }
  /* ذاكرة القاعدة: قيمة XAMPP الافتراضية 16 ميجابايت فقط، فتُقرأ البيانات من القرص في كل طلب */
  try { if ((int) $pdo->query('SELECT @@global.innodb_buffer_pool_size')->fetchColumn() < 268435456) $pdo->exec('SET GLOBAL innodb_buffer_pool_size = 268435456'); } catch (Throwable $e) { /* يلزم تعديل my.ini يدوياً */ }
  /* مئات المستخدمين: القيمة الافتراضية 151 اتصالاً تنفد عند الذروة فتظهر أخطاء Too many connections */
  try { if ((int) $pdo->query('SELECT @@global.max_connections')->fetchColumn() < 500) $pdo->exec('SET GLOBAL max_connections = 500'); } catch (Throwable $e) { /* يلزم تعديل my.ini يدوياً */ }
  $ready = false;
  try { $pdo->query('SELECT 1 FROM counters LIMIT 1'); $ready = true; } catch (Throwable $e) { /* أول تشغيل: إنشاء الجداول */ }
  if ($ready) { setup_v4($pdo); @file_put_contents($flag, 'v5'); return; }
  $pdo->exec("CREATE TABLE IF NOT EXISTS docs (
    store VARCHAR(40) NOT NULL,
    doc_id VARCHAR(120) NOT NULL,
    rev BIGINT UNSIGNED NOT NULL,
    updated_at BIGINT NOT NULL,
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    data LONGTEXT NOT NULL,
    PRIMARY KEY (store, doc_id),
    KEY idx_rev (rev)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS counters (
    name VARCHAR(40) NOT NULL PRIMARY KEY,
    value BIGINT UNSIGNED NOT NULL DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
    token CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(120) NOT NULL,
    created BIGINT NOT NULL,
    expires BIGINT NOT NULL,
    agent VARCHAR(190) NULL,
    KEY idx_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->exec("CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(120) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(120) NOT NULL,
    size INT UNSIGNED NOT NULL,
    created BIGINT NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  $pdo->prepare("INSERT IGNORE INTO counters (name, value) VALUES ('rev', 0)")->execute();
  setup_v4($pdo);
  @file_put_contents($flag, 'v5');
}

/** جداول الإصدار 4: التواجد وحجوزات المهام (لا تمر بسجل التغييرات) */
function setup_v4(PDO $pdo): void {
  /* بيانات مؤقتة بطبيعتها: في الذاكرة (MEMORY) بلا كتابة على القرص مع كل نبضة. تُفرغ عند إعادة تشغيل MySQL ولا ضرر */
  $tables = [
    'presence' => "CREATE TABLE IF NOT EXISTS presence (user_id VARCHAR(120) NOT NULL PRIMARY KEY, at BIGINT NOT NULL, data VARCHAR(600) NOT NULL) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4",
    'leases' => "CREATE TABLE IF NOT EXISTS leases (name VARCHAR(120) NOT NULL PRIMARY KEY, holder CHAR(32) NOT NULL, expires_at BIGINT NOT NULL) ENGINE=MEMORY DEFAULT CHARSET=utf8mb4",
  ];
  foreach ($tables as $t => $ddl) {
    $st = $pdo->prepare("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
    $st->execute([$t]);
    $eng = $st->fetchColumn();
    if ($eng !== false && strcasecmp((string) $eng, 'MEMORY') !== 0) $pdo->exec("DROP TABLE `$t`");
    try { $pdo->exec($ddl); } catch (Throwable $e) { $pdo->exec(str_replace('ENGINE=MEMORY', 'ENGINE=InnoDB', $ddl)); }
  }
}

const PRESENCE_TTL = 150000;

/* ── الاستبيانات ── */
function survey_doc(string $sid): ?array {
  if ($sid === '') return null;
  $d = doc_get('surveys', $sid);
  if (!$d || !empty($d['deleted'])) return null;
  $s = json_decode($d['data'], true);
  return is_array($s) ? $s : null;
}
function survey_in_audience(array $s, array $u): bool {
  $a = is_array($s['audience'] ?? null) ? $s['audience'] : [];
  $roles = (array) ($a['roles'] ?? []); $deps = (array) ($a['departments'] ?? []); $users = (array) ($a['users'] ?? []);
  if (in_array((string) ($u['id'] ?? ''), $users, true)) return true;
  if ($users && !$roles && !$deps) return false;
  return (!$roles || in_array($u['role'] ?? '', $roles, true)) && (!$deps || in_array((string) ($u['departmentId'] ?? ''), $deps, true));
}
function survey_like(string $sid): string { return addcslashes($sid, '\\%_') . ':%'; }
function survey_marks_count(string $sid): int {
  $st = db()->prepare("SELECT COUNT(*) FROM docs WHERE store = 'surveyMarks' AND deleted = 0 AND doc_id LIKE ?");
  $st->execute([survey_like($sid)]);
  return (int) $st->fetchColumn();
}
/** هل يُقبل رد هذا المستخدم الآن؟ منشور، ظاهر، ضمن المدة والجمهور، ولم يصل حد المشاركات */
function survey_open_for(?array $s, array $u, bool $edit = false): bool {
  if (!$s || ($s['status'] ?? '') !== 'live' || !empty($s['hidden'])) return false;
  $t = now_ms();
  if (!empty($s['startAt']) && $t < (int) $s['startAt']) return false;
  if (!empty($s['endAt']) && $t > (int) $s['endAt'] + 5 * 60000) return false;
  if (!survey_in_audience($s, $u)) return false;
  if ($edit) return !empty($s['allowEdit']) && empty($s['anonymous']);
  if (!empty($s['maxResponses']) && survey_marks_count((string) ($s['id'] ?? '')) >= (int) $s['maxResponses']) return false;
  return true;
}
/** من يرى ردود الآخرين وتسجيلات المشاركة: مدير الاستبيانات فقط */
function survey_private_rows(array $rows, array $user): array {
  if (can($user, 'surveys.manage')) return $rows;
  $me = (string) ($user['id'] ?? '');
  return array_values(array_filter($rows, fn($r) => !in_array($r['store'], ['surveyResponses', 'surveyMarks'], true) || (int) $r['deleted'] || (string) (($r['_d'] ?? [])['userId'] ?? '') === $me));
}

/*
 * نطاق المزامنة: الموظف (بلا صلاحيات إضافية) لا يحتاج إلا بياناته والقوائم المشتركة.
 * كان كل جهاز يستلم نسخة كاملة من قاعدة البيانات (كل البلاغات والمحادثات والإشعارات وسجل النشاط)،
 * فتكبر قاعدة كل جهاز بلا حد ويعيد كل جهاز رسم صفحاته مع كل تغيير في أي مكان.
 */
const SELF_SKIP = ['activity', 'worklog', 'workFolders', 'workItems', 'movements', 'vouchers', 'stock', 'deptStock', 'unitStock', 'maintenance', 'backups', 'handles'];
function sync_scope(array $u): string {
  return (($u['role'] ?? '') === 'department' && empty($u['extraPerms'])) ? 'self' : 'all';
}
/** شرط SQL لنطاق الموظف: يستبعد في قاعدة البيانات نفسها ما لا يخصه، فلا يُنقل ولا يُفك في PHP */
function self_sql(array $u): array {
  $skip = implode(',', array_map(fn($x) => db()->quote($x), SELF_SKIP));
  $j = fn(string $f) => "JSON_UNQUOTE(JSON_EXTRACT(data, '$.$f'))";
  $me = (string) ($u['id'] ?? ''); $dep = (string) ($u['departmentId'] ?? '');
  $cond = " AND (deleted = 1 OR (store NOT IN ($skip)"
    . " AND (store <> 'tickets' OR {$j('requesterId')} = ?)"
    . " AND (store NOT IN ('notifications', 'chats') OR {$j('userId')} = ?)"
    . " AND (store <> 'loans' OR {$j('borrowerId')} = ?)"
    . " AND (store <> 'assets' OR {$j('holderId')} = ? OR {$j('departmentId')} = ?)"
    . " AND (store NOT IN ('surveyResponses', 'surveyMarks') OR {$j('userId')} = ?)))";
  return [$cond, [$me, $me, $me, $me, $dep === '' ? "\0" : $dep, $me]];
}
/** ملّاك سجلات أب (بلاغ أو استفسار) لمعرفة من يرى السجلات التابعة لها */
function owners_of(string $store, array $ids, string $field, array $known): array {
  $out = [];
  foreach ($ids as $id) if (isset($known[$id])) $out[$id] = $known[$id];
  $need = array_values(array_diff($ids, array_keys($out)));
  foreach (array_chunk($need, 500) as $chunk) {
    $st = db()->prepare("SELECT doc_id, data FROM docs WHERE store = ? AND doc_id IN (" . implode(',', array_fill(0, count($chunk), '?')) . ")");
    $st->execute(array_merge([$store], $chunk));
    foreach ($st->fetchAll() as $r) { $d = json_decode($r['data'], true); $out[$r['doc_id']] = is_array($d) ? (string) ($d[$field] ?? '') : ''; }
  }
  return $out;
}
/** يُبقي من دفعة السحب ما يخص الموظف فقط. $rows: صفوف فيها '_d' (البيانات بعد فك JSON) */
function visible_rows(array $rows, array $u): array {
  $me = (string) ($u['id'] ?? ''); $dep = (string) ($u['departmentId'] ?? '');
  $tKnown = []; $cKnown = []; $tNeed = []; $cNeed = [];
  foreach ($rows as $r) {
    $d = $r['_d'];
    if (!is_array($d)) continue;
    if ($r['store'] === 'tickets') $tKnown[$r['doc_id']] = (string) ($d['requesterId'] ?? '');
    elseif ($r['store'] === 'chats') $cKnown[$r['doc_id']] = (string) ($d['userId'] ?? '');
    elseif ($r['store'] === 'ticketEvents' || $r['store'] === 'attachments') $tNeed[(string) ($d['ticketId'] ?? '')] = 1;
    elseif ($r['store'] === 'chatMsgs') $cNeed[(string) ($d['chatId'] ?? '')] = 1;
  }
  $tOwn = $tNeed ? owners_of('tickets', array_keys($tNeed), 'requesterId', $tKnown) : [];
  $cOwn = $cNeed ? owners_of('chats', array_keys($cNeed), 'userId', $cKnown) : [];
  $out = [];
  foreach ($rows as $r) {
    $st = $r['store']; $d = $r['_d'];
    if (in_array($st, SELF_SKIP, true)) continue;
    /* حذف سجل: لا بيانات لمعرفة صاحبه، ويُرسل (لا ضرر من حذف ما ليس عند الجهاز) */
    if ((int) $r['deleted'] || !is_array($d)) { $out[] = $r; continue; }
    switch ($st) {
      case 'meta': $k = (string) ($d['key'] ?? $r['doc_id']); $ok = strpos($k, 'lock:') !== 0 && strpos($k, 'presence:') !== 0; break;
      case 'tickets': $ok = (string) ($d['requesterId'] ?? '') === $me; break;
      case 'ticketEvents': case 'attachments': $ok = ($tOwn[(string) ($d['ticketId'] ?? '')] ?? '') === $me; break;
      case 'notifications': $ok = (string) ($d['userId'] ?? '') === $me; break;
      case 'chats': $ok = (string) ($d['userId'] ?? '') === $me; break;
      case 'chatMsgs': $ok = ($cOwn[(string) ($d['chatId'] ?? '')] ?? '') === $me; break;
      case 'loans': $ok = (string) ($d['borrowerId'] ?? '') === $me; break;
      case 'assets': $ok = (string) ($d['holderId'] ?? '') === $me || ($dep !== '' && (string) ($d['departmentId'] ?? '') === $dep); break;
      case 'surveyResponses': case 'surveyMarks': $ok = (string) ($d['userId'] ?? '') === $me; break;
      default: $ok = true;
    }
    if ($ok) $out[] = $r;
  }
  return $out;
}
/** المتواجدون الآن. الموظف العادي لا يرى الصفحة التي يتصفحها غيره */
function presence_list(array $user): array {
  $st = db()->prepare("SELECT data FROM presence WHERE at > ?");
  $st->execute([now_ms() - PRESENCE_TTL]);
  $staff = in_array($user['role'] ?? '', ['supervisor', 'support_manager', 'technician'], true);
  $out = [];
  foreach ($st->fetchAll() as $row) {
    $v = json_decode($row['data'], true);
    if (!is_array($v)) continue;
    if (!$staff) unset($v['page']);
    $out[] = $v;
  }
  return $out;
}

function bump_rev(int $n = 1): int {
  $pdo = db();
  $pdo->prepare("UPDATE counters SET value = LAST_INSERT_ID(value + ?) WHERE name = 'rev'")->execute([$n]);
  return (int) $pdo->lastInsertId();
}

function current_rev(): int {
  $row = db()->query("SELECT value FROM counters WHERE name = 'rev'")->fetch();
  return (int) ($row['value'] ?? 0);
}

function token_of(): string {
  /* لا يُقبل الرمز في عنوان الرابط حتى لا يظهر في سجلات الخادم وسجل المتصفح */
  $t = $_SERVER['HTTP_X_TOKEN'] ?? '';
  if ($t === '') { $b = body(); $t = $b['token'] ?? ''; }
  return is_string($t) ? $t : '';
}

function session_user(bool $required = true): ?array {
  global $CONFIG;
  $token = token_of();
  if ($token === '') { if ($required) fail('غير مصرح: لا يوجد رمز جلسة', 401); return null; }
  $st = db()->prepare("SELECT user_id, expires FROM sessions WHERE token = ?");
  $st->execute([$token]);
  $row = $st->fetch();
  if (!$row || (int) $row['expires'] < now_ms()) { if ($required) fail('انتهت الجلسة، سجّل الدخول من جديد', 401); return null; }
  $doc = doc_get('users', (string) $row['user_id']);
  if (!$doc || !empty($doc['deleted'])) { if ($required) fail('الحساب غير موجود', 401); return null; }
  $user = json_decode($doc['data'], true) ?: [];
  if (($user['active'] ?? 1) == 0) { if ($required) fail('الحساب موقوف', 403); return null; }
  $user['id'] = (string) $row['user_id'];
  return $user;
}

function doc_get(string $store, string $id): ?array {
  $st = db()->prepare("SELECT store, doc_id, rev, deleted, data FROM docs WHERE store = ? AND doc_id = ?");
  $st->execute([$store, $id]);
  $row = $st->fetch();
  return $row ?: null;
}

/** الحقول التي لا تُرسل للعملاء */
function strip_user(array $data): array { unset($data['pass']); return $data; }

/* ── الصلاحيات: نسخة مطابقة لما في الواجهة، حتى لا يعتمد الأمان على المتصفح وحده ── */
const TECH_PERMS = ['dashboard', 'tickets.view', 'tickets.create', 'tickets.work', 'tickets.all', 'kb.read', 'forms', 'profile', 'notifications', 'users.password', 'chat.answer', 'worklog'];
function role_perms(string $role): array {
  switch ($role) {
    case 'department': return ['dashboard', 'tickets.view', 'tickets.create', 'kb.read', 'forms', 'profile', 'notifications'];
    case 'technician': return TECH_PERMS;
    case 'support_manager': return array_merge(TECH_PERMS, ['reports', 'worklog.all', 'works']);
    case 'supervisor': return ['*'];
    case 'monitor': return ['monitor'];
  }
  return [];
}
function can(array $u, string $perm): bool {
  $role = (string) ($u['role'] ?? 'department');
  if ($role === 'monitor') return $perm === 'monitor';
  $p = role_perms($role);
  if (in_array('*', $p, true)) return true;
  if (in_array($perm, (array) ($u['deniedPerms'] ?? []), true)) return false;
  return in_array($perm, $p, true) || in_array($perm, (array) ($u['extraPerms'] ?? []), true);
}
function can_any(array $u, array $perms): bool { foreach ($perms as $p) if (can($u, $p)) return true; return false; }
function is_sup(array $u): bool { return ($u['role'] ?? '') === 'supervisor'; }

/** من يحق له تعيين كلمة مرور لغيره (مطابق للواجهة) */
function can_set_password(array $actor, array $target): bool {
  if (($actor['id'] ?? '') === ($target['id'] ?? '')) return false;
  if (is_sup($actor) || can($actor, 'users.manage')) return true;
  if (!can($actor, 'users.password')) return false;
  if (($actor['role'] ?? '') === 'support_manager') return in_array($target['role'] ?? '', ['department', 'technician'], true);
  if (($actor['role'] ?? '') === 'technician') return ($target['role'] ?? '') === 'department';
  return false;
}

/** حقول لا يغيّرها صاحب الحساب بنفسه */
const USER_PROTECTED = ['role', 'username', 'active', 'extraPerms', 'deniedPerms', 'categories', 'system', 'name', 'militaryNo', 'rankId', 'createdAt', 'imported', 'demo'];

/**
 * يقرر مصير عملية كتابة واحدة: يعيد البيانات المسموح حفظها، أو null للرفض.
 * $old = السجل الحالي على الخادم (أو null)، $new = ما أرسله المتصفح.
 */
function authorize(array $user, string $store, ?array $old, $new, bool $deleted) {
  if (is_sup($user)) return $new;
  $role = (string) ($user['role'] ?? 'department');
  if ($role === 'monitor') return $store === 'meta' ? $new : null;
  $data = is_array($new) ? $new : [];

  switch ($store) {
    case 'users': {
      $target = $old ?: $data;
      $privileged = in_array($target['role'] ?? '', ['supervisor', 'support_manager'], true) || in_array($data['role'] ?? '', ['supervisor', 'support_manager'], true) || !empty($target['system']);
      if (can($user, 'users.manage') && !$privileged) return $new;
      if ($deleted || !$old) return null;
      $merged = $old;
      if (($old['id'] ?? '') === ($user['id'] ?? '')) {
        /* صاحب الحساب: الملف الشخصي وكلمة مروره فقط */
        foreach ($data as $k => $v) if (!in_array($k, USER_PROTECTED, true) && $k !== 'mustChangePassword' && $k !== 'pass') $merged[$k] = $v;
        $changedPass = isset($data['pass']) && is_array($data['pass']) && ($data['pass']['hash'] ?? '') !== (($old['pass'] ?? [])['hash'] ?? '');
        if ($changedPass) { $merged['pass'] = $data['pass']; $merged['mustChangePassword'] = 0; }
        return $merged;
      }
      $changedPass = isset($data['pass']) && is_array($data['pass']) && ($data['pass']['hash'] ?? '') !== (($old['pass'] ?? [])['hash'] ?? '');
      if ($changedPass && can_set_password($user, $old)) { $merged['pass'] = $data['pass']; $merged['mustChangePassword'] = (int) ($data['mustChangePassword'] ?? 1); $merged['updatedAt'] = $data['updatedAt'] ?? ($old['updatedAt'] ?? 0); return $merged; }
      /* تحديد مسؤولي الفئات من إدارة البلاغات */
      if (can_any($user, ['categories.manage', 'settings'])) { $merged['categories'] = $data['categories'] ?? ($old['categories'] ?? []); $merged['updatedAt'] = $data['updatedAt'] ?? ($old['updatedAt'] ?? 0); return $merged; }
      return null;
    }
    case 'categories': return can_any($user, ['settings', 'categories.manage', 'categories.docs']) ? $new : null;
    case 'departments': return can_any($user, ['settings', 'org.manage', 'users.manage']) ? $new : null;
    case 'deptUnits': return can_any($user, ['settings', 'org.manage']) ? $new : null;
    case 'locations': return can_any($user, ['settings', 'users.manage', 'inventory.manage']) ? $new : null;
    case 'ranks': case 'printers': case 'warehouses': case 'itemCategories': return can_any($user, ['settings', 'inventory.manage']) ? $new : null;
    case 'forms': return can_any($user, ['settings', 'forms.manage', 'users.manage']) ? $new : null;
    case 'settings': return can($user, 'settings') ? $new : null;
    case 'surveys': return can($user, 'surveys.manage') ? $new : null;
    case 'surveyResponses': {
      if ($deleted) return can($user, 'surveys.manage') ? $new : null;
      $me = (string) ($user['id'] ?? ''); $sid = (string) ($data['surveyId'] ?? ''); $rid = (string) ($data['id'] ?? ''); $uid = (string) ($data['userId'] ?? '');
      if ($sid === '' || strpos($rid, $sid . ':') !== 0) return null;
      $s = survey_doc($sid); if (!$s) return null;
      if (!empty($s['anonymous'])) {
        /* مجهول الهوية: بلا اسم، وبمعرّف لا يدل على صاحبه، ومرة واحدة فقط */
        if ($uid !== '' || $old || $rid === "$sid:$me") return null;
        if (doc_get('surveyMarks', "$sid:$me")) return null;
        return survey_open_for($s, $user) ? $new : null;
      }
      if ($uid !== $me || $rid !== "$sid:$me") return null;
      if ($old) return ((string) ($old['userId'] ?? '') === $me && survey_open_for($s, $user, true)) ? $new : null;
      return survey_open_for($s, $user) ? $new : null;
    }
    case 'surveyMarks': {
      if ($deleted) return can($user, 'surveys.manage') ? $new : null;
      $me = (string) ($user['id'] ?? ''); $sid = (string) ($data['surveyId'] ?? '');
      if ((string) ($data['userId'] ?? '') !== $me || (string) ($data['id'] ?? '') !== "$sid:$me") return null;
      return doc_get('surveyMarks', "$sid:$me") ? $new : null;
    }
    case 'replies': {
      $me = (string) ($user['id'] ?? ''); $tgt = $old ?: $data;
      if (($tgt['scope'] ?? '') === 'all' || ($data['scope'] ?? '') === 'all') return can_any($user, ['replies.manage', 'users.manage']) ? $new : null;
      return ((string) ($tgt['userId'] ?? '') === $me && (!$old || (string) ($old['userId'] ?? '') === $me)) ? $new : null;
    }
    /* الإشعارات: يُنشئها النظام لأي مستخدم، لكن لا يحذفها إلا صاحبها */
    case 'notifications': return !$deleted || (string) (($old ?? [])['userId'] ?? '') === (string) ($user['id'] ?? '') ? $new : null;
    case 'meta': {
      $key = (string) ($data['key'] ?? ($old['key'] ?? ''));
      if ($key === 'settings') return can($user, 'settings') ? $new : null;
      if ($key === 'imglib') return can_any($user, ['settings', 'categories.manage']) ? $new : null;
      if ($key === 'navhide') return can_any($user, ['settings', 'nav.manage']) ? $new : null;
      if ($key === 'ratingcfg') return can_any($user, ['settings', 'ratings.manage']) ? $new : null;
      if ($key === 'seed:replies2') return can_any($user, ['replies.manage', 'users.manage']) ? $new : null;
      if (strpos($key, 'lock:') === 0) return null;
      if (strpos($key, 'presence:') === 0) return $key === 'presence:' . ($user['id'] ?? '') ? $new : null;
      return $new;
    }
  }
  return $new;
}

function verify_password(string $password, $pass): bool {
  if (!is_array($pass)) return false;
  $algo = $pass['algo'] ?? '';
  if ($algo === 'pbkdf2-sha256') {
    $salt = @hex2bin((string) ($pass['salt'] ?? ''));
    if ($salt === false) return false;
    $calc = bin2hex(hash_pbkdf2('sha256', $password, $salt, (int) ($pass['iter'] ?? 1000), 32, true));
    return hash_equals((string) ($pass['hash'] ?? ''), $calc);
  }
  if ($algo === 'legacy') {
    $kind = $pass['kind'] ?? 'plain';
    $value = (string) ($pass['value'] ?? '');
    if ($kind === 'plain') return hash_equals($value, $password);
    if ($kind === 'sha256') return hash_equals(strtolower($value), hash('sha256', $password));
  }
  return false;
}

setup();
$action = (string) ($_GET['a'] ?? $_GET['action'] ?? 'ping');

switch ($action) {

case 'ping': {
  /* كان يعدّ أربعة جداول كاملة مع كل فتح للصفحة؛ الواجهة تحتاج فقط: هل يوجد مستخدمون؟ */
  $has = (bool) db()->query("SELECT 1 FROM docs WHERE store = 'users' AND deleted = 0 LIMIT 1")->fetchColumn();
  out(['ok' => true, 'server' => 'sqapa-sync', 'version' => 5, 'rev' => current_rev(), 'time' => now_ms(), 'empty' => !$has]);
}

case 'login': {
  $b = body();
  $username = trim((string) ($b['username'] ?? ''));
  $password = (string) ($b['password'] ?? '');
  if ($username === '' || $password === '') fail('أدخل اسم المستخدم وكلمة المرور');
  $st = db()->prepare("SELECT doc_id, data FROM docs WHERE store = 'users' AND deleted = 0");
  $st->execute();
  $found = null;
  foreach ($st->fetchAll() as $row) {
    $u = json_decode($row['data'], true) ?: [];
    if (lc(trim((string) ($u['username'] ?? ''))) === lc($username)) { $found = [$row['doc_id'], $u]; break; }
  }
  if (!$found) fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
  [$uid, $user] = $found;
  if (($user['active'] ?? 1) == 0) fail('الحساب موقوف، راجع مشرف النظام', 403);
  $lockKey = 'lock:' . $uid;
  $lockDoc = doc_get('meta', $lockKey);
  /* السجل محفوظ بصيغة {key, value: {tries, until}}؛ القراءة السابقة من المستوى الخطأ جعلت القفل لا يعمل أبداً */
  $lockRec = $lockDoc ? (json_decode($lockDoc['data'], true) ?: []) : [];
  $lock = is_array($lockRec['value'] ?? null) ? $lockRec['value'] : [];
  if ((int) ($lock['until'] ?? 0) > now_ms()) fail('الحساب مقفل مؤقتاً بسبب محاولات خاطئة، حاول بعد قليل', 429);
  if (!verify_password($password, $user['pass'] ?? null)) {
    $tries = (int) ($lock['tries'] ?? 0) + 1;
    $val = ['tries' => $tries, 'until' => $tries >= 5 ? now_ms() + 5 * 60 * 1000 : 0];
    $rev = bump_rev();
    $st = db()->prepare("INSERT INTO docs (store, doc_id, rev, updated_at, deleted, data) VALUES ('meta', ?, ?, ?, 0, ?) ON DUPLICATE KEY UPDATE rev = VALUES(rev), updated_at = VALUES(updated_at), data = VALUES(data), deleted = 0");
    $st->execute([$lockKey, $rev, now_ms(), json_encode(['key' => $lockKey, 'value' => $val], JSON_UNESCAPED_UNICODE)]);
    fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
  }
  /* دخول ناجح: تصفير عداد المحاولات الخاطئة حتى لا تتراكم عبر الأيام */
  if ((int) ($lock['tries'] ?? 0) > 0) {
    $rev = bump_rev();
    db()->prepare("UPDATE docs SET rev = ?, updated_at = ?, data = ? WHERE store = 'meta' AND doc_id = ?")->execute([$rev, now_ms(), json_encode(['key' => $lockKey, 'value' => ['tries' => 0, 'until' => 0]], JSON_UNESCAPED_UNICODE), $lockKey]);
  }
  $hours = 12;
  $setDoc = doc_get('meta', 'settings');
  if ($setDoc) { $s = json_decode($setDoc['data'], true) ?: []; $v = $s['value'] ?? []; $hours = (int) ($v['sessionHours'] ?? 12); }
  $token = bin2hex(random_bytes(32));
  $ins = db()->prepare("INSERT INTO sessions (token, user_id, created, expires, agent) VALUES (?, ?, ?, ?, ?)");
  $ins->execute([$token, $uid, now_ms(), now_ms() + max(1, $hours) * 3600 * 1000, cut((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 180)]);
  db()->prepare("DELETE FROM sessions WHERE expires < ?")->execute([now_ms()]);
  $user['id'] = $uid;
  out(['token' => $token, 'user' => strip_user($user), 'rev' => current_rev()]);
}

case 'me': {
  $user = session_user();
  out(['user' => strip_user($user), 'rev' => current_rev()]);
}

case 'logout': {
  $token = token_of();
  if ($token !== '') db()->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
  out(['ok' => true]);
}

case 'pull': {
  $user = session_user();
  $since = (int) ($_GET['since'] ?? (body()['since'] ?? 0));
  $limit = min(3000, max(50, (int) ($_GET['limit'] ?? 1500)));
  /* قائمة المتواجدين ترافق السحب (جدول صغير مستقل) بدل أن تكون سجلات متزامنة */
  $extra = !empty($_GET['pres']) ? ['presence' => presence_list($user)] : [];
  /* لا جديد منذ آخر سحب: رد فوري دون استعلام (أغلب طلبات الأجهزة الدورية) */
  $head = current_rev();
  if ($since >= $head) out(['rev' => $since, 'head' => $head, 'docs' => [], 'more' => false, 'scope' => sync_scope($user)] + $extra);
  $scope = sync_scope($user);
  [$cond, $args] = $scope === 'self' ? self_sql($user) : ['', []];
  $fetch = function (string $where, array $params, string $limit = '') use (&$cond, &$args) {
    try { $st = db()->prepare("SELECT store, doc_id, rev, deleted, data FROM docs WHERE $where$cond ORDER BY rev ASC$limit"); $st->execute(array_merge($params, $args)); }
    catch (Throwable $e) { /* MySQL قديم بلا دوال JSON: التصفية في PHP وحدها */ $cond = ''; $args = []; $st = db()->prepare("SELECT store, doc_id, rev, deleted, data FROM docs WHERE $where ORDER BY rev ASC$limit"); $st->execute($params); }
    return $st->fetchAll();
  };
  $rows = $fetch('rev > ?', [$since], ' LIMIT ' . ($limit + 1));
  $more = count($rows) > $limit;
  if ($more) {
    /* كل سجلات الدفعة الواحدة تحمل رقم التغيير نفسه: لا تُقطع الصفحة في منتصف رقم، وإلا ضاع باقيه في السحب التالي (rev > آخر رقم) */
    $last = (int) $rows[$limit]['rev'];
    $rows = array_values(array_filter(array_slice($rows, 0, $limit), fn($r) => (int) $r['rev'] !== $last));
    if (!$rows) $rows = $fetch('rev = ?', [$last]);
  }
  $docs = [];
  $max = $since;
  foreach ($rows as $i => $row) { $rows[$i]['_d'] = json_decode($row['data'], true); unset($rows[$i]['data']); $max = max($max, (int) $row['rev']); }
  /* رقم التقدم يشمل الصفوف المحجوبة عن هذا المستخدم، وإلا أعاد طلبها في كل سحب.
     بلا صفحات أخرى فقد فُحص كل ما حتى head (العداد والسجلات يُحفظان في معاملة واحدة) */
  if (!$more) $max = max($max, $head);
  if ($scope === 'self') $rows = visible_rows($rows, $user);
  else $rows = survey_private_rows($rows, $user);
  foreach ($rows as $row) {
    $data = $row['_d'];
    if ($row['store'] === 'users' && is_array($data)) $data = strip_user($data);
    $docs[] = ['store' => $row['store'], 'id' => $row['doc_id'], 'rev' => (int) $row['rev'], 'deleted' => (int) $row['deleted'], 'data' => $data];
  }
  out(['rev' => $max, 'head' => $head, 'docs' => $docs, 'more' => $more, 'scope' => $scope] + $extra);
}

case 'beat': {
  $user = session_user();
  $b = body();
  $uid = (string) $user['id'];
  if (!empty($b['leave'])) {
    db()->prepare("DELETE FROM presence WHERE user_id = ?")->execute([$uid]);
    out(['ok' => true]);
  }
  $v = is_array($b['value'] ?? null) ? $b['value'] : [];
  $t = now_ms();
  $val = [
    'userId' => $uid, 'role' => (string) ($user['role'] ?? ''), 'at' => $t,
    'since' => (int) ($v['since'] ?? $t), 'act' => min($t, (int) ($v['act'] ?? $t)), 'page' => cut((string) ($v['page'] ?? ''), 120),
  ];
  db()->prepare("REPLACE INTO presence (user_id, at, data) VALUES (?, ?, ?)")->execute([$uid, $t, json_encode($val, JSON_UNESCAPED_UNICODE)]);
  if (mt_rand(1, 50) === 1) db()->prepare("DELETE FROM presence WHERE at < ?")->execute([$t - PRESENCE_TTL]);
  out(['ok' => true, 'presence' => presence_list($user)]);
}

case 'lease': {
  /* حجز ذري: أول جهاز يطلب المهمة ينفذها، والباقون يتجاوزونها حتى انتهاء المدة */
  $user = session_user();
  if (!can_any($user, ['tickets.work', 'chat.answer', 'settings', 'loans.manage', 'inventory.manage'])) out(['ok' => false]);
  $b = body();
  $name = cut(preg_replace('/[^a-zA-Z0-9_:.-]/', '', (string) ($b['name'] ?? '')), 120);
  if ($name === '') fail('لم يُحدد اسم المهمة');
  $ttl = max(10000, min(DAY_MS, (int) ($b['ttl'] ?? 60000)));
  $t = now_ms(); $me = bin2hex(random_bytes(16));
  db()->prepare("INSERT INTO leases (name, holder, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE holder = IF(expires_at < ?, VALUES(holder), holder), expires_at = IF(expires_at < ?, VALUES(expires_at), expires_at)")
    ->execute([$name, $me, $t + $ttl, $t, $t]);
  $st = db()->prepare("SELECT holder FROM leases WHERE name = ?");
  $st->execute([$name]);
  out(['ok' => $st->fetchColumn() === $me]);
}

case 'push': {
  $user = session_user(false);
  if (!$user) {
    $c = (int) db()->query("SELECT COUNT(*) c FROM docs WHERE store = 'users' AND deleted = 0")->fetch()['c'];
    if ($c > 0) fail('غير مصرح: لا يوجد رمز جلسة', 401);
    $user = ['role' => 'supervisor', 'id' => 'bootstrap'];
  }
  $b = body();
  $ops = $b['ops'] ?? [];
  if (!is_array($ops) || !count($ops)) out(['rev' => current_rev(), 'applied' => [], 'conflicts' => []]);
  if (count($ops) > 2000) fail('عدد العمليات كبير جداً في طلب واحد');
  $pdo = db();
  $applied = []; $conflicts = [];
  $pdo->beginTransaction();
  try {
    $rev = bump_rev();
    $sel = $pdo->prepare("SELECT rev, data, deleted FROM docs WHERE store = ? AND doc_id = ? FOR UPDATE");
    $ins = $pdo->prepare("INSERT INTO docs (store, doc_id, rev, updated_at, deleted, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rev = VALUES(rev), updated_at = VALUES(updated_at), deleted = VALUES(deleted), data = VALUES(data)");
    foreach ($ops as $op) {
      $store = (string) ($op['store'] ?? '');
      $id = (string) ($op['id'] ?? '');
      if ($store === '' || $id === '') continue;
      $sel->execute([$store, $id]);
      $cur = $sel->fetch();
      $curData = $cur ? (json_decode($cur['data'], true) ?: []) : null;
      $deleted = !empty($op['deleted']) ? 1 : 0;
      /* الحذف لا يحمل بيانات: يُفحص على السجل الحالي، وإلا رُفض كل حذف من غير المشرف (كان authorize يعيد null) */
      $allowed = authorize($user, $store, $curData, $deleted ? ($curData ?? []) : ($op['data'] ?? null), (bool) $deleted);
      if ($allowed === null) {
        /* رفض: نعيد النسخة الصحيحة من الخادم ليرجع إليها المتصفح */
        $back = $curData; if ($store === 'users' && is_array($back)) $back = strip_user($back);
        $conflicts[] = ['store' => $store, 'id' => $id, 'rev' => $cur ? (int) $cur['rev'] : 0, 'deleted' => $cur ? (int) $cur['deleted'] : 0, 'data' => $back, 'reason' => 'no_permission'];
        continue;
      }
      $op['data'] = $deleted ? null : $allowed;
      $expected = (int) ($op['rev'] ?? 0);
      if ($cur && $expected !== (int) $cur['rev'] && $expected !== -1) {
        $data = json_decode($cur['data'], true);
        if ($store === 'users' && is_array($data)) $data = strip_user($data);
        $conflicts[] = ['store' => $store, 'id' => $id, 'rev' => (int) $cur['rev'], 'deleted' => (int) $cur['deleted'], 'data' => $data, 'reason' => 'conflict'];
        continue;
      }
      $data = $op['data'] ?? null;
      if ($store === 'users' && is_array($data) && $cur) {
        $old = json_decode($cur['data'], true) ?: [];
        if (!isset($data['pass']) && isset($old['pass'])) $data['pass'] = $old['pass'];
      }
      $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
      if ($json !== false && strlen($json) > max_doc_bytes()) { $conflicts[] = ['store' => $store, 'id' => $id, 'reason' => 'too_large', 'size' => strlen($json), 'max' => max_doc_bytes()]; continue; }
      $ins->execute([$store, $id, $rev, now_ms(), $deleted, $json === false ? '{}' : $json]);
      $applied[] = ['store' => $store, 'id' => $id, 'rev' => $rev];
      /* رد جديد على استبيان: يسجّل الخادم بنفسه أن المستخدم شارك، فلا يُكرَّر الرد ولو تجاوز أحد الواجهة */
      if ($store === 'surveyResponses' && !$deleted && !$cur && is_array($data)) {
        $sid = (string) ($data['surveyId'] ?? ''); $mid = $sid . ':' . (string) ($user['id'] ?? '');
        if ($sid !== '' && !doc_get('surveyMarks', $mid)) {
          $ins->execute(['surveyMarks', $mid, $rev, now_ms(), 0, json_encode(['id' => $mid, 'surveyId' => $sid, 'userId' => (string) ($user['id'] ?? ''), 'at' => now_ms()], JSON_UNESCAPED_UNICODE)]);
          $applied[] = ['store' => 'surveyMarks', 'id' => $mid, 'rev' => $rev];
        }
      }
    }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('تعذر حفظ التغييرات: ' . $e->getMessage(), 500);
  }
  out(['rev' => current_rev(), 'applied' => $applied, 'conflicts' => $conflicts]);
}

case 'seq': {
  session_user();
  $b = body();
  $names = $b['names'] ?? [];
  if (!is_array($names) || !count($names)) fail('لم تُحدد العدادات المطلوبة');
  $pdo = db();
  $outv = [];
  $pdo->beginTransaction();
  try {
    foreach ($names as $name => $count) {
      $name = preg_replace('/[^a-zA-Z0-9_:.-]/', '', (string) $name);
      $n = max(1, min(5000, (int) $count));
      $pdo->prepare("INSERT IGNORE INTO counters (name, value) VALUES (?, 0)")->execute(['seq:' . $name]);
      $pdo->prepare("UPDATE counters SET value = LAST_INSERT_ID(value + ?) WHERE name = ?")->execute([$n, 'seq:' . $name]);
      $end = (int) $pdo->lastInsertId();
      $outv[$name] = ['start' => $end - $n + 1, 'end' => $end];
    }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('تعذر توليد الأرقام: ' . $e->getMessage(), 500);
  }
  out(['seq' => $outv]);
}

case 'seqset': {
  $user = session_user(false);
  if (!$user) { $c = (int) db()->query("SELECT COUNT(*) c FROM docs WHERE store = 'users' AND deleted = 0")->fetch()['c']; if ($c > 0) fail('غير مصرح', 401); }
  elseif (($user['role'] ?? '') !== 'supervisor') fail('هذه العملية للمشرف فقط', 403);
  $b = body();
  foreach (($b['names'] ?? []) as $name => $value) {
    $name = preg_replace('/[^a-zA-Z0-9_:.-]/', '', (string) $name);
    $st = db()->prepare("INSERT INTO counters (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = GREATEST(value, VALUES(value))");
    $st->execute(['seq:' . $name, max(0, (int) $value)]);
  }
  out(['ok' => true]);
}

case 'upload': {
  global $CONFIG;
  session_user();
  if (empty($_FILES['file'])) fail('لم يصل أي ملف');
  $f = $_FILES['file'];
  if (($f['error'] ?? 1) !== UPLOAD_ERR_OK) fail('فشل رفع الملف');
  if ($f['size'] > ($CONFIG['max_upload_mb'] * 1024 * 1024)) fail('حجم الملف أكبر من المسموح');
  $id = (string) ($_POST['id'] ?? bin2hex(random_bytes(12)));
  $id = preg_replace('/[^A-Za-z0-9_.-]/', '', $id);
  $dir = rtrim($CONFIG['files_dir'], '/\\');
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  /* منع فتح المرفقات مباشرة من المتصفح إن كان المجلد داخل htdocs: لا تُقرأ إلا عبر api.php بجلسة صالحة */
  if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
  if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
  if ($id === '') $id = bin2hex(random_bytes(12));
  $path = $dir . DIRECTORY_SEPARATOR . $id . '.bin';
  /* معرّف موجود مسبقاً: لا يُستبدل ملف مستخدم آخر (إعادة المحاولة تُعد ناجحة دون كتابة) */
  $ex = db()->prepare("SELECT size FROM files WHERE id = ?");
  $ex->execute([$id]);
  if ($ex->fetch() && is_file($path)) out(['ok' => true, 'id' => $id, 'size' => (int) filesize($path), 'existing' => true]);
  if (!move_uploaded_file($f['tmp_name'], $path)) fail('تعذر حفظ الملف على الخادم', 500);
  $st = db()->prepare("INSERT INTO files (id, name, type, size, created) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), size = VALUES(size)");
  $st->execute([$id, cut((string) ($_POST['name'] ?? $f['name']), 240), cut((string) ($_POST['type'] ?? $f['type']), 110), (int) $f['size'], now_ms()]);
  out(['ok' => true, 'id' => $id, 'size' => (int) $f['size']]);
}

case 'file': {
  global $CONFIG;
  session_user();
  $id = preg_replace('/[^A-Za-z0-9_.-]/', '', (string) ($_GET['id'] ?? ''));
  if ($id === '') fail('لم يُحدد الملف');
  $st = db()->prepare("SELECT name, type, size FROM files WHERE id = ?");
  $st->execute([$id]);
  $row = $st->fetch();
  $path = rtrim($CONFIG['files_dir'], '/\\') . DIRECTORY_SEPARATOR . $id . '.bin';
  if (!$row || !is_file($path)) fail('الملف غير موجود', 404);
  /* تُعرض داخل المتصفح الأنواع الآمنة فقط؛ HTML وSVG وغيرها تُنزّل كملف ولا تُنفّذ داخل نطاق النظام (حماية من XSS) */
  $type = strtolower(trim(explode(';', (string) $row['type'])[0]));
  $inline = in_array($type, ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'video/mp4', 'audio/mpeg'], true);
  $name = (string) $row['name'];
  $ascii = preg_replace('/[^A-Za-z0-9._-]/', '_', $name) ?: 'file';
  header_remove('Content-Type');
  header_remove('Cache-Control');
  header('Content-Type: ' . ($inline ? $type : 'application/octet-stream'));
  header('Content-Length: ' . filesize($path));
  header('Content-Disposition: ' . ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($name));
  if ($type !== 'application/pdf') header("Content-Security-Policy: default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  /* محتوى الملف لا يتغير أبداً لنفس المعرّف: يُحفظ في ذاكرة المتصفح بدل تنزيله في كل فتح للبلاغ */
  header('Cache-Control: private, max-age=31536000, immutable');
  readfile($path);
  exit;
}

/* حذف بيانات التجربة قبل التشغيل الرسمي: للمشرف فقط، ويُطلب كتابة عبارة التأكيد.
   تُحذف السجلات كعلامات حذف حتى تُزال من كل الأجهزة عند مزامنتها، وتُحذف ملفاتها، ويُعاد ترقيم العدادات */
case 'wipe': {
  global $CONFIG;
  $user = session_user();
  if (!is_sup($user)) fail('هذه العملية للمشرف فقط', 403);
  $b = body();
  if (trim((string) ($b['confirm'] ?? '')) !== 'حذف بيانات التجربة') fail('عبارة التأكيد غير صحيحة', 400);
  $groups = [
    'tickets' => ['tickets', 'ticketEvents', 'attachments'],
    'chats' => ['chats', 'chatMsgs'],
    'notifications' => ['notifications'],
    'inventory' => ['items', 'stock', 'deptStock', 'unitStock', 'movements', 'loans', 'assets', 'vouchers', 'maintenance'],
    'works' => ['worklog', 'workFolders', 'workItems'],
    'surveys' => ['surveys', 'surveyResponses', 'surveyMarks'],
    'announcements' => ['announcements'],
    'activity' => ['activity'],
  ];
  $seqOf = ['tickets' => ['seq:ticket'], 'inventory' => ['seq:item', 'seq:loan', 'seq:voucher']];
  $pick = array_values(array_intersect(array_keys($groups), array_map('strval', (array) ($b['groups'] ?? []))));
  $users = !empty($b['users']);
  if (!$pick && !$users) fail('اختر البيانات المراد حذفها', 400);
  $stores = []; foreach ($pick as $g) $stores = array_merge($stores, $groups[$g]);
  $pdo = db(); $counts = []; $files = [];
  $pdo->beginTransaction();
  try {
    $rev = bump_rev(1); $t = now_ms();
    if ($stores) {
      $in = implode(',', array_fill(0, count($stores), '?'));
      $q = $pdo->prepare("SELECT store, COUNT(*) c FROM docs WHERE deleted = 0 AND store IN ($in) GROUP BY store");
      $q->execute($stores);
      foreach ($q->fetchAll() as $r) $counts[$r['store']] = (int) $r['c'];
      $q = $pdo->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(data, '$.fileId')) f FROM docs WHERE deleted = 0 AND store IN ($in) AND JSON_EXTRACT(data, '$.fileId') IS NOT NULL");
      $q->execute($stores);
      foreach ($q->fetchAll() as $r) if ($r['f']) $files[] = (string) $r['f'];
      $pdo->prepare("UPDATE docs SET deleted = 1, data = '{}', rev = ?, updated_at = ? WHERE deleted = 0 AND store IN ($in)")->execute(array_merge([$rev, $t], $stores));
    }
    if ($users) {
      /* الحسابات التجريبية: يبقى حساب المشرف الحالي وكل المشرفين وحسابات النظام */
      $q = $pdo->query("SELECT doc_id, data FROM docs WHERE store = 'users' AND deleted = 0");
      $del = [];
      foreach ($q->fetchAll() as $r) {
        $d = json_decode($r['data'], true) ?: [];
        if ($r['doc_id'] === (string) $user['id'] || ($d['role'] ?? '') === 'supervisor' || ($d['role'] ?? '') === 'monitor' || !empty($d['system'])) continue;
        $del[] = $r['doc_id'];
      }
      if ($del) {
        $in = implode(',', array_fill(0, count($del), '?'));
        $pdo->prepare("UPDATE docs SET deleted = 1, data = '{}', rev = ?, updated_at = ? WHERE store = 'users' AND doc_id IN ($in)")->execute(array_merge([$rev, $t], $del));
        try { $pdo->prepare("DELETE FROM sessions WHERE user_id IN ($in)")->execute($del); } catch (Throwable $e) { /* جدول الجلسات باسم مختلف */ }
      }
      $counts['users'] = count($del);
    }
    foreach ($pick as $g) foreach ($seqOf[$g] ?? [] as $name) $pdo->prepare("DELETE FROM counters WHERE name = ?")->execute([$name]);
    if ($files) { $in = implode(',', array_fill(0, count($files), '?')); $pdo->prepare("DELETE FROM files WHERE id IN ($in)")->execute($files); }
    $pdo->commit();
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('تعذر حذف البيانات: ' . $e->getMessage(), 500);
  }
  $dir = rtrim((string) ($CONFIG['files_dir'] ?? ''), '/\\');
  if ($dir !== '') foreach ($files as $f) { $f = preg_replace('/[^A-Za-z0-9_.-]/', '', $f); if ($f !== '') @unlink($dir . DIRECTORY_SEPARATOR . $f . '.bin'); }
  out(['ok' => true, 'rev' => current_rev(), 'counts' => (object) $counts, 'files' => count($files)]);
}

case 'svstats': {
  $user = session_user();
  $sid = (string) ($_GET['id'] ?? '');
  $s = survey_doc($sid); if (!$s) fail('الاستبيان غير موجود', 404);
  $me = (string) $user['id'];
  if (!can($user, 'surveys.manage') && !(!empty($s['showResults']) && doc_get('surveyMarks', "$sid:$me"))) fail('النتائج غير متاحة لهذا الاستبيان', 403);
  $types = []; foreach ((array) ($s['questions'] ?? []) as $q) if (is_array($q)) $types[(string) ($q['id'] ?? '')] = (string) ($q['t'] ?? '');
  $st = db()->prepare("SELECT data FROM docs WHERE store = 'surveyResponses' AND deleted = 0 AND doc_id LIKE ?");
  $st->execute([survey_like($sid)]);
  $agg = []; $n = 0;
  foreach ($st->fetchAll() as $r) {
    $d = json_decode($r['data'], true); if (!is_array($d)) continue; $n++;
    foreach ((array) ($d['answers'] ?? []) as $qid => $v) {
      $qid = (string) $qid; $t = $types[$qid] ?? '';
      if ($t === '' || in_array($t, ['text', 'textarea', 'date', 'section'], true)) continue;
      if (!isset($agg[$qid])) $agg[$qid] = ['n' => 0, 'c' => [], 'sum' => 0, 'num' => 0, 'rows' => []];
      $agg[$qid]['n']++;
      if ($t === 'matrix' && is_array($v)) { foreach ($v as $row => $k) { $row = (string) $row; if (!isset($agg[$qid]['rows'][$row])) $agg[$qid]['rows'][$row] = ['n' => 0, 'sum' => 0]; $agg[$qid]['rows'][$row]['n']++; $agg[$qid]['rows'][$row]['sum'] += (float) $k; } continue; }
      foreach ((is_array($v) ? $v : [$v]) as $x) {
        if (!is_scalar($x)) continue;
        $k = (string) $x; $agg[$qid]['c'][$k] = ($agg[$qid]['c'][$k] ?? 0) + 1;
        if (is_int($x) || is_float($x)) { $agg[$qid]['sum'] += $x; $agg[$qid]['num']++; }
      }
    }
  }
  foreach ($agg as &$a) { $a['c'] = (object) $a['c']; $a['rows'] = (object) $a['rows']; $a['texts'] = []; } unset($a);
  out(['n' => $n, 'q' => (object) $agg]);
}

case 'diag': {
  /* فحص سرعة الخادم وإعداداته: يظهر للمشرف في نافذة «المزامنة والخادم» */
  $user = session_user();
  if (!is_sup($user)) fail('هذه الصفحة للمشرف فقط', 403);
  global $CONFIG;
  $t0 = microtime(true);
  try { $p = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', strtolower((string) $CONFIG['host']) === 'localhost' ? '127.0.0.1' : $CONFIG['host'], $CONFIG['port'], $CONFIG['database']), $CONFIG['user'], $CONFIG['password']); $p = null; } catch (Throwable $e) { /* يظهر في القياس */ }
  $connect = round((microtime(true) - $t0) * 1000, 1);
  $t0 = microtime(true); for ($i = 0; $i < 20; $i++) db()->query('SELECT 1')->fetchColumn(); $query = round((microtime(true) - $t0) * 1000 / 20, 2);
  $t0 = microtime(true); db()->query("SELECT COUNT(*) FROM docs WHERE rev > " . max(0, current_rev() - 200))->fetchColumn(); $pullq = round((microtime(true) - $t0) * 1000, 1);
  $g = function (string $v) { try { return db()->query("SELECT @@global.$v")->fetchColumn(); } catch (Throwable $e) { return null; } };
  $status = []; foreach (db()->query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Max_used_connections','Uptime')")->fetchAll() as $r) $status[$r['Variable_name']] = (int) $r['Value'];
  $size = (int) db()->query("SELECT COALESCE(SUM(data_length + index_length),0) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()")->fetchColumn();
  $op = function_exists('opcache_get_status') ? @opcache_get_status(false) : false;
  $checks = [
    ['opcache', 'تسريع PHP (OPcache)', !empty($op['opcache_enabled']), 'فعّل zend_extension=opcache و opcache.enable=1 في php.ini'],
    ['connect', "زمن الاتصال بقاعدة البيانات: {$connect} ms", $connect < 50, 'أكثر من 50ms: اجعل host في config.php = 127.0.0.1 وأضف skip-name-resolve في my.ini'],
    ['query', "زمن الاستعلام: {$query} ms", $query < 5, 'الخادم مشغول أو القرص بطيء'],
    ['maxconn', 'الحد الأقصى للاتصالات: ' . $g('max_connections'), (int) $g('max_connections') >= 500, 'max_connections=500 في my.ini'],
    ['pool', 'ذاكرة قاعدة البيانات: ' . round((int) $g('innodb_buffer_pool_size') / 1048576) . ' MB', (int) $g('innodb_buffer_pool_size') >= 268435456, 'innodb_buffer_pool_size=512M في my.ini'],
    ['packet', 'أقصى حجم للسجل: ' . round((int) $g('max_allowed_packet') / 1048576) . ' MB', (int) $g('max_allowed_packet') >= 33554432, 'max_allowed_packet=64M في my.ini'],
    ['flush', 'كتابة السجل على القرص: ' . $g('innodb_flush_log_at_trx_commit'), (int) $g('innodb_flush_log_at_trx_commit') !== 1, 'اختياري لتسريع الحفظ: innodb_flush_log_at_trx_commit=2'],
  ];
  out(['php' => PHP_VERSION, 'mysql' => (string) $g('version'), 'connect_ms' => $connect, 'query_ms' => $query, 'pull_ms' => $pullq, 'status' => $status, 'db_bytes' => $size, 'docs' => (int) db()->query('SELECT COUNT(*) FROM docs')->fetchColumn(), 'online' => count(presence_list($user)),
    'checks' => array_map(fn($c) => ['key' => $c[0], 'label' => $c[1], 'ok' => (bool) $c[2], 'fix' => $c[3]], $checks)]);
}

case 'stats': {
  $user = session_user();
  if (($user['role'] ?? '') !== 'supervisor') fail('هذه الصفحة للمشرف فقط', 403);
  $rows = db()->query("SELECT store, COUNT(*) c, SUM(deleted) d FROM docs GROUP BY store ORDER BY c DESC")->fetchAll();
  $sessions = (int) db()->query("SELECT COUNT(*) c FROM sessions WHERE expires > " . now_ms())->fetch()['c'];
  $files = db()->query("SELECT COUNT(*) c, COALESCE(SUM(size),0) s FROM files")->fetch();
  out(['rev' => current_rev(), 'stores' => $rows, 'sessions' => $sessions, 'files' => ['count' => (int) $files['c'], 'bytes' => (int) $files['s']]]);
}

default:
  fail('إجراء غير معروف: ' . $action, 404);
}
