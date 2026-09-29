<?php
/**
 * نظام الدعم الفني والمخازن — خادم المزامنة
 * يعمل على XAMPP (Apache + PHP + MySQL) دون أي إضافات.
 * الملف الوحيد الذي تحتاج تعديله هو config.php
 *
 * تحديث 2026-09: صلاحيات مطابقة للواجهة على الخادم، تغيير المستخدم كلمة مروره وملفه الشخصي،
 * عدم توقف المزامنة بسبب ملف أكبر من max_allowed_packet، إنشاء قاعدة البيانات تلقائياً،
 * وحماية مجلد المرفقات من الفتح المباشر.
 */
declare(strict_types=1);
@ini_set('display_errors', '0');
error_reporting(E_ALL);
if (function_exists('mb_internal_encoding')) mb_internal_encoding('UTF-8');
function lc(string $s): string { return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s); }
function cut(string $s, int $n): string { return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n); }

$CONFIG = require __DIR__ . '/config.php';

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
  if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
  echo json_encode(['error' => 'خطأ في الخادم: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
});

function out($data, int $code = 200): void { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function fail(string $msg, int $code = 400): void { out(['error' => $msg], $code); }
function body(): array { $raw = file_get_contents('php://input'); if ($raw === '' || $raw === false) return []; $j = json_decode($raw, true); return is_array($j) ? $j : []; }
function now_ms(): int { return (int) round(microtime(true) * 1000); }

function db(): PDO {
  global $CONFIG; static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  $dsn = $CONFIG['dsn'] ?: sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $CONFIG['host'], $CONFIG['port'], $CONFIG['database']);
  $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
  try {
    $pdo = new PDO($dsn, $CONFIG['user'], $CONFIG['password'], $opts);
  } catch (PDOException $e) {
    /* قاعدة البيانات غير موجودة بعد: تُنشأ تلقائياً في أول تشغيل */
    if (empty($CONFIG['dsn']) && (int) ($e->errorInfo[1] ?? 0) === 1049) {
      try {
        $root = new PDO(sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $CONFIG['host'], $CONFIG['port']), $CONFIG['user'], $CONFIG['password'], $opts);
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
  $pdo = db();
  /* رفع الحد تلقائياً إن سمحت صلاحيات المستخدم (حساب root في XAMPP يسمح). يسري على الاتصالات التالية حتى إعادة تشغيل MySQL */
  try { if ((int) $pdo->query('SELECT @@global.max_allowed_packet')->fetchColumn() < 67108864) $pdo->exec('SET GLOBAL max_allowed_packet = 67108864'); } catch (Throwable $e) { /* يلزم تعديل my.ini يدوياً */ }
  try { $pdo->query('SELECT 1 FROM counters LIMIT 1'); return; } catch (Throwable $e) { /* أول تشغيل: إنشاء الجداول */ }
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
  $t = $_SERVER['HTTP_X_TOKEN'] ?? '';
  if ($t === '') { $b = body(); $t = $b['token'] ?? ''; }
  if ($t === '') $t = $_GET['token'] ?? '';
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
    case 'meta': {
      $key = (string) ($data['key'] ?? ($old['key'] ?? ''));
      if ($key === 'settings') return can($user, 'settings') ? $new : null;
      if ($key === 'imglib') return can_any($user, ['settings', 'categories.manage']) ? $new : null;
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
  $counts = [];
  foreach (['users', 'tickets', 'items', 'movements'] as $s) {
    $st = db()->prepare("SELECT COUNT(*) c FROM docs WHERE store = ? AND deleted = 0");
    $st->execute([$s]);
    $counts[$s] = (int) $st->fetch()['c'];
  }
  out(['ok' => true, 'server' => 'sqapa-sync', 'version' => 3, 'rev' => current_rev(), 'time' => now_ms(), 'counts' => $counts, 'empty' => $counts['users'] === 0]);
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
  $lock = $lockDoc ? (json_decode($lockDoc['data'], true) ?: []) : [];
  if ((int) ($lock['until'] ?? 0) > now_ms()) fail('الحساب مقفل مؤقتاً بسبب محاولات خاطئة، حاول بعد قليل', 429);
  if (!verify_password($password, $user['pass'] ?? null)) {
    $tries = (int) ($lock['tries'] ?? 0) + 1;
    $val = ['tries' => $tries, 'until' => $tries >= 5 ? now_ms() + 5 * 60 * 1000 : 0];
    $rev = bump_rev();
    $st = db()->prepare("INSERT INTO docs (store, doc_id, rev, updated_at, deleted, data) VALUES ('meta', ?, ?, ?, 0, ?) ON DUPLICATE KEY UPDATE rev = VALUES(rev), updated_at = VALUES(updated_at), data = VALUES(data), deleted = 0");
    $st->execute([$lockKey, $rev, now_ms(), json_encode(['key' => $lockKey, 'value' => $val], JSON_UNESCAPED_UNICODE)]);
    fail('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
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
  session_user();
  $since = (int) ($_GET['since'] ?? (body()['since'] ?? 0));
  $limit = min(3000, max(50, (int) ($_GET['limit'] ?? 1500)));
  $st = db()->prepare("SELECT store, doc_id, rev, deleted, data FROM docs WHERE rev > ? ORDER BY rev ASC, store ASC LIMIT " . $limit);
  $st->execute([$since]);
  $docs = [];
  $max = $since;
  foreach ($st->fetchAll() as $row) {
    $data = json_decode($row['data'], true);
    if ($row['store'] === 'users' && is_array($data)) $data = strip_user($data);
    $docs[] = ['store' => $row['store'], 'id' => $row['doc_id'], 'rev' => (int) $row['rev'], 'deleted' => (int) $row['deleted'], 'data' => $data];
    $max = max($max, (int) $row['rev']);
  }
  out(['rev' => $max, 'head' => current_rev(), 'docs' => $docs, 'more' => count($docs) >= $limit]);
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
      $allowed = authorize($user, $store, $curData, $op['data'] ?? null, (bool) $deleted);
      if ($allowed === null) {
        /* رفض: نعيد النسخة الصحيحة من الخادم ليرجع إليها المتصفح */
        $back = $curData; if ($store === 'users' && is_array($back)) $back = strip_user($back);
        $conflicts[] = ['store' => $store, 'id' => $id, 'rev' => $cur ? (int) $cur['rev'] : 0, 'deleted' => $cur ? (int) $cur['deleted'] : 0, 'data' => $back, 'reason' => 'no_permission'];
        continue;
      }
      $op['data'] = $allowed;
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
  $path = $dir . DIRECTORY_SEPARATOR . $id . '.bin';
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
  header_remove('Content-Type');
  header('Content-Type: ' . ($row['type'] ?: 'application/octet-stream'));
  header('Content-Length: ' . filesize($path));
  header('Content-Disposition: inline; filename="' . rawurlencode((string) $row['name']) . '"');
  readfile($path);
  exit;
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
