<?php
declare(strict_types=1);

const ADMINS = ['мирон' => true, 'тимур' => true];
const ORIGINS = [
  'https://tima0anon.github.io' => true,
  'http://pw902.castledev.ru' => true,
  'https://pw902.castledev.ru' => true,
  'https://numdrop.online' => true,
  'http://numdrop.online' => true,
  'http://127.0.0.1:5173' => true,
  'http://localhost:5173' => true,
  'http://127.0.0.1:5174' => true,
  'http://localhost:5174' => true,
];

$config = require __DIR__ . '/config.php';
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allow = isset(ORIGINS[$origin]) ? $origin : 'https://tima0anon.github.io';
header('Access-Control-Allow-Origin: ' . $allow);
header('Access-Control-Allow-Headers: content-type, authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Vary: Origin');
header('Content-Type: application/json; charset=utf-8');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
if (empty($_SERVER['HTTP_AUTHORIZATION'])) {
  if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  elseif (function_exists('apache_request_headers')) {
    foreach (apache_request_headers() as $name => $value) {
      if (strcasecmp($name, 'Authorization') === 0) $_SERVER['HTTP_AUTHORIZATION'] = $value;
    }
  }
}

function out(array $body, int $status = 200): void {
  http_response_code($status);
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

function nickKey(string $nick): string {
  return mb_strtolower(trim($nick), 'UTF-8');
}

function cleanNick(string $nick): string {
  $nick = trim($nick);
  if (!preg_match('/^[\p{L}\p{N}_]{3,16}$/u', $nick)) out(['error' => 'Ник: 3–16 букв, цифр или _'], 400);
  return $nick;
}

try {
  $db = new PDO(
    'mysql:host=' . $config['host'] . ';port=' . (int) ($config['port'] ?? 3306) . ';dbname=' . $config['name'] . ';charset=utf8mb4',
    $config['user'],
    $config['pass'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
  );
} catch (Throwable $e) {
  out(['error' => 'База не открылась'], 500);
}

$db->exec('CREATE TABLE IF NOT EXISTS users (
  nick_key VARCHAR(32) PRIMARY KEY,
  nick VARCHAR(32) NOT NULL,
  pass_hash VARCHAR(255) NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  role VARCHAR(16) NOT NULL DEFAULT "",
  banned TINYINT NOT NULL DEFAULT 0,
  cash_code TINYINT NOT NULL DEFAULT 0,
  force_json TEXT NULL,
  seen_at BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  nick_key VARCHAR(32) NOT NULL,
  exp BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS gifts (
  id VARCHAR(64) PRIMARY KEY,
  to_nick VARCHAR(32) NOT NULL,
  from_nick VARCHAR(32) NOT NULL,
  from_display VARCHAR(32) NOT NULL,
  plate_json TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX (to_nick)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->exec('CREATE TABLE IF NOT EXISTS meta (id TINYINT PRIMARY KEY, epoch INT NOT NULL) ENGINE=InnoDB');
$db->exec('INSERT IGNORE INTO meta (id, epoch) VALUES (1, 1)');
foreach (['мирон', 'тимур'] as $admin) {
  $check = $db->prepare('SELECT nick_key FROM users WHERE nick_key = ?');
  $check->execute([$admin]);
  if (!$check->fetch()) {
    $hash = password_hash('007123', PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO users (nick_key, nick, pass_hash, role, seen_at) VALUES (?, ?, ?, "admin", ?)');
    $stmt->execute([$admin, $admin, $hash, (int) (microtime(true) * 1000)]);
  }
}
foreach (['save_json MEDIUMTEXT NULL', 'save_at BIGINT NOT NULL DEFAULT 0', 'hidden TINYINT NOT NULL DEFAULT 0'] as $column) {
  try { $db->exec('ALTER TABLE users ADD COLUMN ' . $column); } catch (Throwable $e) {}
}

function epoch(PDO $db): int {
  $row = $db->query('SELECT epoch FROM meta WHERE id = 1')->fetch();
  return (int) ($row['epoch'] ?? 1);
}

function userBy(PDO $db, string $key): ?array {
  $stmt = $db->prepare('SELECT * FROM users WHERE nick_key = ?');
  $stmt->execute([$key]);
  $row = $stmt->fetch();
  if (!$row) return null;
  if (isset(ADMINS[$row['nick_key']]) && $row['role'] !== 'admin') {
    $db->prepare('UPDATE users SET role = "admin" WHERE nick_key = ?')->execute([$key]);
    $row['role'] = 'admin';
  }
  return $row;
}

function patchSave(?string $json, callable $change): ?string {
  if ($json === null || $json === '') return null;
  $save = json_decode($json, true);
  if (!is_array($save)) return null;
  $change($save);
  $encoded = json_encode($save, JSON_UNESCAPED_UNICODE);
  return $encoded === false ? null : $encoded;
}

function placeOf(PDO $db, string $key): ?int {
  $rows = $db->query('SELECT nick_key FROM users WHERE banned = 0 AND hidden = 0 ORDER BY balance DESC, nick ASC')->fetchAll();
  foreach ($rows as $i => $row) if ($row['nick_key'] === $key) return $i + 1;
  return null;
}

function profile(PDO $db, array $user): array {
  $force = $user['force_json'] ? json_decode($user['force_json'], true) : null;
  return [
    'nick' => $user['nick'],
    'balance' => (int) $user['balance'],
    'place' => placeOf($db, $user['nick_key']),
    'role' => $user['role'] ?: '',
    'epoch' => epoch($db),
    'banned' => (bool) $user['banned'],
    'force' => $force ?: null,
  ];
}

function body(): array {
  $raw = file_get_contents('php://input') ?: '';
  if (strlen($raw) > 8000) out(['error' => 'Слишком большой запрос'], 400);
  if ($raw === '') return [];
  $data = json_decode($raw, true);
  if (!is_array($data)) out(['error' => 'Не понял запрос'], 400);
  return $data;
}

function sessionNick(PDO $db): ?string {
  $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (strncmp($header, 'Bearer ', 7) !== 0) return null;
  $token = trim(substr($header, 7));
  if ($token === '' || strlen($token) > 128) return null;
  $hash = hash('sha256', $token);
  $stmt = $db->prepare('SELECT nick_key, exp FROM sessions WHERE token_hash = ?');
  $stmt->execute([$hash]);
  $row = $stmt->fetch();
  if (!$row || (int) $row['exp'] < (int) (microtime(true) * 1000)) return null;
  return $row['nick_key'];
}

function issue(PDO $db, string $key): string {
  $token = bin2hex(random_bytes(32));
  $exp = (int) (microtime(true) * 1000) + 30 * 86400000;
  $stmt = $db->prepare('INSERT INTO sessions (token_hash, nick_key, exp) VALUES (?, ?, ?)');
  $stmt->execute([hash('sha256', $token), $key, $exp]);
  return $token;
}

function requireUser(PDO $db): array {
  $key = sessionNick($db);
  if (!$key) out(['error' => 'Нужно войти'], 401);
  $user = userBy($db, $key);
  if (!$user) out(['error' => 'Аккаунт не найден'], 401);
  if ($user['banned']) out(['error' => 'Аккаунт заблокирован', 'banned' => true], 403);
  return $user;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#^.*/api#', '', $path) ?: '/';
$path = rtrim($path, '/') ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && $path === '/health') out(['ok' => true]);

if ($method === 'GET' && $path === '/me') {
  $user = requireUser($db);
  $row = profile($db, $user);
  if (($_GET['save'] ?? '') === '1') {
    $row['save'] = !empty($user['save_json']) ? json_decode($user['save_json'], true) : null;
    $row['saveAt'] = (int) ($user['save_at'] ?? 0);
  }
  out($row);
}

if ($method === 'GET' && $path === '/top') {
  $rows = $db->query('SELECT nick, balance FROM users WHERE banned = 0 AND hidden = 0 ORDER BY balance DESC, nick ASC LIMIT 100')->fetchAll();
  $top = [];
  foreach ($rows as $i => $row) $top[] = ['nick' => $row['nick'], 'balance' => (int) $row['balance'], 'place' => $i + 1];
  $key = sessionNick($db);
  $me = null;
  if ($key) {
    $user = userBy($db, $key);
    if ($user && !$user['banned']) $me = profile($db, $user);
  }
  out(['top' => $top, 'me' => $me]);
}

if ($method === 'POST' && ($path === '/register' || $path === '/login')) {
  $data = body();
  $nick = cleanNick((string) ($data['nick'] ?? ''));
  $password = (string) ($data['password'] ?? '');
  if (strlen($password) < 6 || strlen($password) > 72) out(['error' => 'Пароль: от 6 до 72 символов'], 400);
  $key = nickKey($nick);
  $existing = userBy($db, $key);
  if ($path === '/register') {
    if ($existing) out(['error' => 'Такой ник уже занят'], 409);
    $role = isset(ADMINS[$key]) ? 'admin' : '';
    $stmt = $db->prepare('INSERT INTO users (nick_key, nick, pass_hash, role, seen_at) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$key, $nick, password_hash($password, PASSWORD_DEFAULT), $role, (int) (microtime(true) * 1000)]);
    $existing = userBy($db, $key);
  } else {
    if (!$existing || !password_verify($password, $existing['pass_hash'])) out(['error' => 'Неверный ник или пароль'], 401);
    if ($existing['banned']) out(['error' => 'Аккаунт заблокирован', 'banned' => true], 403);
  }
  $token = issue($db, $key);
  $fresh = userBy($db, $key);
  $answer = ['token' => $token] + profile($db, $fresh);
  $answer['save'] = !empty($fresh['save_json']) ? json_decode($fresh['save_json'], true) : null;
  $answer['saveAt'] = (int) ($fresh['save_at'] ?? 0);
  out($answer);
}

if ($method === 'POST' && $path === '/save') {
  $user = requireUser($db);
  $raw = file_get_contents('php://input') ?: '';
  if (strlen($raw) > 900000) out(['error' => 'Сохранение слишком большое'], 400);
  $data = json_decode($raw, true);
  $save = is_array($data) ? ($data['save'] ?? null) : null;
  if (!is_array($save)) out(['error' => 'Не понял сохранение'], 400);
  $balance = (int) max(0, (float) ($save['rub'] ?? 0));
  if ($balance > 1e15) $balance = 0;
  $now = (int) (microtime(true) * 1000);
  $db->prepare('UPDATE users SET save_json = ?, save_at = ?, balance = ?, seen_at = ? WHERE nick_key = ?')
    ->execute([json_encode($save, JSON_UNESCAPED_UNICODE), $now, $balance, $now, $user['nick_key']]);
  out(['ok' => true, 'saveAt' => $now]);
}

if ($method === 'POST' && $path === '/score') {
  $user = requireUser($db);
  $data = body();
  $balance = (int) floor((float) ($data['balance'] ?? -1));
  if ($balance < 0 || $balance > 1e15) out(['error' => 'Некорректный баланс'], 400);
  if ((int) ($data['epoch'] ?? -1) !== epoch($db)) out(['error' => 'Сезон обнулён', 'reset' => true, 'epoch' => epoch($db), 'role' => $user['role']], 409);
  $force = $user['force_json'] ? json_decode($user['force_json'], true) : null;
  if ($force && ($data['forceId'] ?? '') !== ($force['id'] ?? '')) out(profile($db, $user));
  if ($force && ($data['forceId'] ?? '') === ($force['id'] ?? '')) {
    $next = ($force['kind'] ?? '') === 'balance' ? (int) $force['rub'] : $balance;
    $db->prepare('UPDATE users SET balance = ?, force_json = NULL, seen_at = ? WHERE nick_key = ?')
      ->execute([$next, (int) (microtime(true) * 1000), $user['nick_key']]);
  } else {
    $db->prepare('UPDATE users SET balance = ?, seen_at = ? WHERE nick_key = ?')
      ->execute([$balance, (int) (microtime(true) * 1000), $user['nick_key']]);
  }
  out(profile($db, userBy($db, $user['nick_key'])));
}

if ($method === 'POST' && $path === '/redeem') {
  requireUser($db);
  out(['error' => 'Нет такого кода'], 400);
}

if ($method === 'POST' && $path === '/gift') {
  $user = requireUser($db);
  $data = body();
  $toNick = cleanNick((string) ($data['to'] ?? ''));
  $to = nickKey($toNick);
  if ($to === $user['nick_key']) out(['error' => 'Нельзя передать номер самому себе'], 400);
  if (!userBy($db, $to)) out(['error' => 'Такого ника нет'], 404);
  $plate = $data['plate'] ?? null;
  if (!is_array($plate) || !isset($plate['plate'], $plate['flag'], $plate['rarity'])) out(['error' => 'Не понял номер'], 400);
  $id = bin2hex(random_bytes(16));
  $stored = [
    'plate' => mb_substr((string) $plate['plate'], 0, 24),
    'flag' => mb_substr((string) $plate['flag'], 0, 8),
    'country' => mb_substr((string) ($plate['country'] ?? ''), 0, 24),
    'rarity' => mb_substr((string) $plate['rarity'], 0, 16),
    'price' => max(0, (int) ($plate['price'] ?? 0)),
    'bought' => max(0, (int) ($plate['bought'] ?? 0)),
    'region' => isset($plate['region']) ? mb_substr((string) $plate['region'], 0, 8) : null,
  ];
  $db->prepare('INSERT INTO gifts (id, to_nick, from_nick, from_display, plate_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    ->execute([$id, $to, $user['nick_key'], $user['nick'], json_encode($stored, JSON_UNESCAPED_UNICODE), (int) (microtime(true) * 1000)]);
  out(['ok' => true, 'id' => $id]);
}

if ($method === 'GET' && $path === '/inbox') {
  $user = requireUser($db);
  $stmt = $db->prepare('SELECT id, from_display, plate_json, created_at FROM gifts WHERE to_nick = ?');
  $stmt->execute([$user['nick_key']]);
  $gifts = [];
  foreach ($stmt->fetchAll() as $row) {
    $gifts[] = ['id' => $row['id'], 'fromNick' => $row['from_display'], 'plate' => json_decode($row['plate_json'], true), 'at' => (int) $row['created_at']];
  }
  out(['gifts' => $gifts]);
}

if ($method === 'POST' && $path === '/inbox/take') {
  $user = requireUser($db);
  $data = body();
  $id = (string) ($data['id'] ?? '');
  if ($id === '' || strlen($id) > 80) out(['error' => 'Не понял посылку'], 400);
  $stmt = $db->prepare('SELECT * FROM gifts WHERE id = ? AND to_nick = ?');
  $stmt->execute([$id, $user['nick_key']]);
  $gift = $stmt->fetch();
  if (!$gift) out(['error' => 'Посылки уже нет'], 404);
  $db->prepare('DELETE FROM gifts WHERE id = ?')->execute([$id]);
  out(['plate' => json_decode($gift['plate_json'], true), 'fromNick' => $gift['from_display']]);
}

if ($method === 'GET' && $path === '/admin/players') {
  $admin = requireUser($db);
  if ($admin['role'] !== 'admin') out(['error' => 'Нет прав администратора'], 403);
  $rows = $db->query('SELECT nick, balance, banned, hidden, seen_at, role, save_json FROM users ORDER BY balance DESC, nick ASC LIMIT 500')->fetchAll();
  $players = [];
  foreach ($rows as $row) {
    $plates = 0;
    if (!empty($row['save_json'])) {
      $save = json_decode($row['save_json'], true);
      if (is_array($save) && isset($save['col']) && is_array($save['col'])) $plates = count($save['col']);
    }
    $players[] = [
      'nick' => $row['nick'],
      'balance' => (int) $row['balance'],
      'banned' => (bool) $row['banned'],
      'hidden' => (bool) $row['hidden'],
      'plates' => $plates,
      'at' => (int) $row['seen_at'],
      'role' => $row['role'] ?: '',
    ];
  }
  out(['players' => $players]);
}

if ($method === 'POST' && $path === '/admin/player') {
  $admin = requireUser($db);
  if ($admin['role'] !== 'admin') out(['error' => 'Нет прав администратора'], 403);
  $data = body();
  $nick = cleanNick((string) ($data['nick'] ?? ''));
  $key = nickKey($nick);
  $user = userBy($db, $key);
  if (!$user) out(['error' => 'Такого игрока нет'], 404);
  $action = (string) ($data['action'] ?? '');
  $staff = ($user['role'] ?? '') === 'admin';
  if ($staff && $action !== 'balance' && $action !== 'grant') out(['error' => 'Админа так менять нельзя'], 400);
  if ($action === 'balance') {
    $rub = (int) floor((float) ($data['balance'] ?? -1));
    if ($rub < 0 || $rub > 1e15) out(['error' => 'Некорректный баланс'], 400);
    $force = json_encode(['id' => bin2hex(random_bytes(16)), 'kind' => 'balance', 'rub' => $rub], JSON_UNESCAPED_UNICODE);
    $patched = patchSave($user['save_json'] ?? null, function (&$save) use ($rub) {
      $save['rub'] = $rub;
      if (!isset($save['peakRub']) || $rub > $save['peakRub']) $save['peakRub'] = $rub;
    });
    if ($patched !== null) {
      $db->prepare('UPDATE users SET balance = ?, force_json = ?, save_json = ? WHERE nick_key = ?')->execute([$rub, $force, $patched, $key]);
    } else {
      $db->prepare('UPDATE users SET balance = ?, force_json = ? WHERE nick_key = ?')->execute([$rub, $force, $key]);
    }
  } elseif ($action === 'grant') {
    $add = (int) floor((float) ($data['balance'] ?? -1));
    if ($add < 1 || $add > 1e15) out(['error' => 'Некорректная сумма'], 400);
    $base = (int) $user['balance'];
    $decoded = !empty($user['save_json']) ? json_decode($user['save_json'], true) : null;
    if (is_array($decoded) && isset($decoded['rub'])) $base = (int) $decoded['rub'];
    $rub = $base + $add;
    if ($rub < 0 || $rub > 1e15) out(['error' => 'Некорректная сумма'], 400);
    $force = json_encode(['id' => bin2hex(random_bytes(16)), 'kind' => 'balance', 'rub' => $rub], JSON_UNESCAPED_UNICODE);
    $patched = patchSave($user['save_json'] ?? null, function (&$save) use ($rub) {
      $save['rub'] = $rub;
      if (!isset($save['peakRub']) || $rub > $save['peakRub']) $save['peakRub'] = $rub;
    });
    if ($patched !== null) {
      $db->prepare('UPDATE users SET balance = ?, force_json = ?, save_json = ? WHERE nick_key = ?')->execute([$rub, $force, $patched, $key]);
    } else {
      $db->prepare('UPDATE users SET balance = ?, force_json = ? WHERE nick_key = ?')->execute([$rub, $force, $key]);
    }
  } elseif ($action === 'reset') {
    $force = json_encode(['id' => bin2hex(random_bytes(16)), 'kind' => 'reset'], JSON_UNESCAPED_UNICODE);
    $db->prepare('UPDATE users SET balance = 0, cash_code = 0, force_json = ? WHERE nick_key = ?')->execute([$force, $key]);
  } elseif ($action === 'garage') {
    $force = json_encode(['id' => bin2hex(random_bytes(16)), 'kind' => 'garage'], JSON_UNESCAPED_UNICODE);
    $patched = patchSave($user['save_json'] ?? null, function (&$save) {
      $save['col'] = [];
      $save['bestNum'] = null;
      $save['myListings'] = [];
    });
    if ($patched !== null) {
      $db->prepare('UPDATE users SET force_json = ?, save_json = ? WHERE nick_key = ?')->execute([$force, $patched, $key]);
    } else {
      $db->prepare('UPDATE users SET force_json = ? WHERE nick_key = ?')->execute([$force, $key]);
    }
  } elseif ($action === 'kick') {
    $db->prepare('DELETE FROM sessions WHERE nick_key = ?')->execute([$key]);
  } elseif ($action === 'hide' || $action === 'show') {
    $db->prepare('UPDATE users SET hidden = ? WHERE nick_key = ?')->execute([$action === 'hide' ? 1 : 0, $key]);
  } elseif ($action === 'ban' || $action === 'unban') {
    if ($key === $admin['nick_key']) out(['error' => 'Себя заблокировать нельзя'], 400);
    $db->prepare('UPDATE users SET banned = ?, balance = IF(? = 1, 0, balance) WHERE nick_key = ?')->execute([$action === 'ban' ? 1 : 0, $action === 'ban' ? 1 : 0, $key]);
    if ($action === 'ban') $db->prepare('DELETE FROM sessions WHERE nick_key = ?')->execute([$key]);
  } else out(['error' => 'Не понял действие'], 400);
  $fresh = userBy($db, $key);
  out(['ok' => true, 'nick' => $fresh['nick'], 'balance' => (int) $fresh['balance'], 'banned' => (bool) $fresh['banned']]);
}

if ($method === 'POST' && $path === '/admin/wipe') {
  $admin = requireUser($db);
  if ($admin['role'] !== 'admin') out(['error' => 'Нет прав администратора'], 403);
  $db->exec('UPDATE meta SET epoch = epoch + 1 WHERE id = 1');
  $db->exec('UPDATE users SET balance = 0, cash_code = 0, force_json = NULL, save_json = NULL, save_at = 0');
  $db->exec('DELETE FROM gifts');
  out(['ok' => true, 'epoch' => epoch($db)]);
}

if ($method === 'POST' && $path === '/logout') {
  $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
  if (strncmp($header, 'Bearer ', 7) === 0) {
    $token = trim(substr($header, 7));
    $db->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
  }
  out(['ok' => true]);
}

out(['error' => 'Нет такого адреса'], 404);
