<?php
declare(strict_types=1);

$secureCookie = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name('pokeca_account');
session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30,
    'path' => '/',
    'secure' => $secureCookie,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dataDir = dirname(__DIR__) . '/.account-data';
$dataFile = $dataDir . '/accounts.json';

function respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_payload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        respond(['ok' => false, 'error' => 'invalid_json'], 400);
    }
    return $payload;
}

function normalize_username(string $username): string
{
    $name = trim($username);
    $name = preg_replace('/\s+/u', '', $name) ?? '';
    return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
}

function validate_username(string $username): ?string
{
    $name = normalize_username($username);
    $length = function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') : strlen($name);
    if ($name === '' || $length < 2 || $length > 40) {
        return null;
    }
    if (!preg_match('/^[\p{L}\p{N}_.@-]+$/u', $name)) {
        return null;
    }
    return $name;
}

function validate_favorites(array $favorites): array
{
    $valid = [];
    foreach ($favorites as $id) {
        if (!is_string($id)) {
            continue;
        }
        $id = trim($id);
        if ($id !== '' && preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
            $valid[$id] = true;
        }
    }
    return array_slice(array_keys($valid), 0, 5000);
}

function validate_card_id($cardId): ?string
{
    if (!is_string($cardId)) {
        return null;
    }
    $id = trim($cardId);
    return $id !== '' && preg_match('/^[A-Za-z0-9_-]+$/', $id) ? $id : null;
}

function validate_purchase_date($date): ?string
{
    if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        return null;
    }
    [$year, $month, $day] = array_map('intval', explode('-', $date));
    return checkdate($month, $day, $year) ? $date : null;
}

function validate_purchase_amount($amount): ?int
{
    if (is_string($amount)) {
        $amount = preg_replace('/[^\d]/', '', $amount);
    }
    if ($amount === '' || $amount === null || !is_numeric($amount)) {
        return null;
    }
    $number = (int)$amount;
    return $number >= 0 && $number <= 999999999 ? $number : null;
}

function ensure_store(): void
{
    global $dataDir, $dataFile;
    if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true) && !is_dir($dataDir)) {
        respond(['ok' => false, 'error' => 'store_unavailable'], 500);
    }
    if (!file_exists($dataFile)) {
        file_put_contents($dataFile, json_encode(['accounts' => []], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
}

function with_store(callable $callback)
{
    global $dataFile;
    ensure_store();
    $handle = fopen($dataFile, 'c+');
    if ($handle === false) {
        respond(['ok' => false, 'error' => 'store_unavailable'], 500);
    }
    flock($handle, LOCK_EX);
    rewind($handle);
    $raw = stream_get_contents($handle);
    $store = json_decode($raw ?: '{"accounts":[]}', true);
    if (!is_array($store) || !isset($store['accounts']) || !is_array($store['accounts'])) {
        $store = ['accounts' => []];
    }
    $result = $callback($store);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($store, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
    return $result;
}

function account_response(array $account): array
{
    return [
        'id' => $account['id'],
        'name' => $account['name'],
        'favorites' => array_values($account['favorites'] ?? []),
        'purchases' => (object)($account['purchases'] ?? []),
    ];
}

function current_account(): ?array
{
    $accountId = $_SESSION['account_id'] ?? '';
    if (!is_string($accountId) || $accountId === '') {
        return null;
    }
    return with_store(function (array &$store) use ($accountId) {
        return $store['accounts'][$accountId] ?? null;
    });
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$payload = $method === 'POST' ? read_payload() : [];
$action = $payload['action'] ?? ($_GET['action'] ?? 'me');

if ($method === 'GET' && $action === 'me') {
    $account = current_account();
    respond(['ok' => true, 'account' => $account ? account_response($account) : null]);
}

if ($method !== 'POST') {
    respond(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
    }
    session_destroy();
    respond(['ok' => true, 'account' => null]);
}

if ($action === 'register' || $action === 'login') {
    $username = validate_username((string)($payload['username'] ?? ''));
    $password = (string)($payload['password'] ?? '');
    if ($username === null || strlen($password) < 4 || strlen($password) > 200) {
        respond(['ok' => false, 'error' => 'invalid_credentials'], 400);
    }

    $account = with_store(function (array &$store) use ($action, $username, $password) {
        $existing = $store['accounts'][$username] ?? null;
        if ($action === 'register') {
            if ($existing) {
                respond(['ok' => false, 'error' => 'account_exists'], 409);
            }
            $store['accounts'][$username] = [
                'id' => $username,
                'name' => $username,
                'passwordHash' => password_hash($password, PASSWORD_DEFAULT),
                'favorites' => [],
                'purchases' => [],
                'createdAt' => gmdate('c'),
                'updatedAt' => gmdate('c'),
            ];
            return $store['accounts'][$username];
        }

        if (!$existing || !password_verify($password, (string)($existing['passwordHash'] ?? ''))) {
            respond(['ok' => false, 'error' => 'login_failed'], 401);
        }
        return $existing;
    });

    session_regenerate_id(true);
    $_SESSION['account_id'] = $account['id'];
    respond(['ok' => true, 'account' => account_response($account)]);
}

if ($action === 'favorites') {
    $accountId = $_SESSION['account_id'] ?? '';
    if (!is_string($accountId) || $accountId === '') {
        respond(['ok' => false, 'error' => 'not_logged_in'], 401);
    }
    $favorites = validate_favorites(is_array($payload['favorites'] ?? null) ? $payload['favorites'] : []);
    $account = with_store(function (array &$store) use ($accountId, $favorites) {
        if (!isset($store['accounts'][$accountId])) {
            respond(['ok' => false, 'error' => 'not_logged_in'], 401);
        }
        $store['accounts'][$accountId]['favorites'] = $favorites;
        $store['accounts'][$accountId]['updatedAt'] = gmdate('c');
        return $store['accounts'][$accountId];
    });
    respond(['ok' => true, 'account' => account_response($account)]);
}

if ($action === 'purchase') {
    $accountId = $_SESSION['account_id'] ?? '';
    if (!is_string($accountId) || $accountId === '') {
        respond(['ok' => false, 'error' => 'not_logged_in'], 401);
    }
    $cardId = validate_card_id($payload['cardId'] ?? null);
    $date = validate_purchase_date($payload['date'] ?? null);
    $amount = validate_purchase_amount($payload['amount'] ?? null);
    if ($cardId === null || $date === null || $amount === null) {
        respond(['ok' => false, 'error' => 'invalid_purchase'], 400);
    }
    $account = with_store(function (array &$store) use ($accountId, $cardId, $date, $amount) {
        if (!isset($store['accounts'][$accountId])) {
            respond(['ok' => false, 'error' => 'not_logged_in'], 401);
        }
        if (!isset($store['accounts'][$accountId]['purchases']) || !is_array($store['accounts'][$accountId]['purchases'])) {
            $store['accounts'][$accountId]['purchases'] = [];
        }
        $store['accounts'][$accountId]['purchases'][$cardId] = [
            'date' => $date,
            'amount' => $amount,
            'updatedAt' => gmdate('c'),
        ];
        $store['accounts'][$accountId]['updatedAt'] = gmdate('c');
        return $store['accounts'][$accountId];
    });
    respond(['ok' => true, 'account' => account_response($account)]);
}

respond(['ok' => false, 'error' => 'unknown_action'], 400);
