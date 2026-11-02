<?php
declare(strict_types=1);
ini_set('zend.exception_ignore_args', '1');

// Environment variables take precedence over the optional local .env file.
$envFile = __DIR__ . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        if (getenv(trim($key)) === false) putenv(trim($key) . '=' . trim($value));
    }
}

function setting(string $key, string $default = ''): string {
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function databaseOptions(): array {
    $options = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC];
    $ca = setting('DB_SSL_CA');
    if ($ca !== '') {
        if (!is_readable($ca)) throw new RuntimeException('Database CA certificate is unavailable.');
        $options[PDO::MYSQL_ATTR_SSL_CA] = $ca;
        $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
    }
    if (setting('APP_ENV') === 'production' && (setting('COOKIE_SECURE', 'true') !== 'true' || in_array(setting('DB_USER'), ['', 'root'], true) || setting('DB_PASSWORD') === '' || !str_starts_with(setting('APP_ORIGIN'), 'https://') || (!in_array(setting('DB_HOST', '127.0.0.1'), ['127.0.0.1', 'localhost'], true) && $ca === ''))) {
        throw new RuntimeException('Production requires secure cookies, HTTPS, a dedicated database user and TLS for a remote database.');
    }
    return $options;
}

function database(): PDO {
    static $db;
    if (!$db) {
        $db = new PDO(
            'mysql:host=' . setting('DB_HOST', '127.0.0.1') . ';port=' . setting('DB_PORT', '3306') . ';dbname=' . setting('DB_NAME', 'biodiversity_db') . ';charset=utf8mb4',
            setting('DB_USER'), setting('DB_PASSWORD'),
            databaseOptions()
        );
        if (setting('DB_SSL_CA') !== '') {
            $tls = $db->query("SHOW SESSION STATUS LIKE 'Ssl_cipher'")->fetch();
            if (!$tls || ($tls['Value'] ?? '') === '') { $db = null; throw new RuntimeException('Encrypted database transport was not negotiated.'); }
        }
    }
    return $db;
}

function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_THROW_ON_ERROR);
    exit;
}

// $session = false is for bearer-token (mobile) endpoints: no cookies, no CSRF, no credentialed CORS.
function api(array $methods, bool $session = true): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    set_exception_handler(function (Throwable $error): void {
        error_log((string) $error);
        respond(500, ['error' => 'Internal server error']);
    });
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    // Native apps send no Origin. Browser previews of the mobile app must be listed explicitly.
    $allowed = $session ? [setting('APP_ORIGIN', 'http://localhost:5173')] : array_filter(array_map('trim', explode(',', setting('MOBILE_WEB_ORIGINS'))));
    if ($origin !== '' && !in_array($origin, $allowed, true)) {
        respond(403, ['error' => 'Origin not allowed']);
    }
    header('Vary: Origin');
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        if ($session) header('Access-Control-Allow-Credentials: true');
    }
    header('Access-Control-Allow-Headers: ' . ($session ? 'Content-Type, X-CSRF-Token' : 'Content-Type, Authorization'));
    header('Access-Control-Allow-Methods: ' . implode(', ', $methods) . ', OPTIONS');
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    if (!in_array($method, $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        respond(405, ['error' => 'Method not allowed']);
    }
    if (!$session) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/',
        'secure' => setting('COOKIE_SECURE', 'true') === 'true',
        'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_cache_limiter(''); // Preserve the explicit no-store API header.
    session_start();
}

function jsonBody(int $maxBytes = 8192): array {
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
        respond(415, ['error' => 'Content-Type must be application/json']);
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if (strlen($raw) > $maxBytes) respond(413, ['error' => 'Request too large']);
    try { $body = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException $error) { respond(400, ['error' => 'Invalid JSON']); }
    if (!$body instanceof stdClass) respond(400, ['error' => 'Expected a JSON object']);
    return (array) $body;
}

function csrfToken(): string {
    return $_SESSION['csrf_token'] ??= bin2hex(random_bytes(32));
}

function requireCsrf(): void {
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $provided)) {
        respond(403, ['error' => 'Invalid CSRF token']);
    }
}

function destroyLogin(): void {
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 3600, 'path' => $params['path'],
        'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Lax',
    ]);
    session_destroy();
}

function requireLogin(): array {
    $now = time();
    if (!isset($_SESSION['user_id'], $_SESSION['issued_at'], $_SESSION['last_seen'])) {
        respond(401, ['error' => 'Authentication required']);
    }
    if ($now - $_SESSION['last_seen'] >= (int) setting('SESSION_IDLE_SECONDS', '1800') ||
        $now - $_SESSION['issued_at'] >= (int) setting('SESSION_MAX_SECONDS', '28800')) {
        destroyLogin();
        respond(401, ['error' => 'Session expired']);
    }
    $stmt = database()->prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user || !$user['is_active']) {
        destroyLogin();
        respond(401, ['error' => 'Authentication required']);
    }
    unset($user['is_active']);
    $_SESSION['last_seen'] = $now;
    $_SESSION['role'] = $user['role'];
    return $user;
}

function requireRole(array $roles): array {
    $user = requireLogin();
    if (!in_array($user['role'], $roles, true)) respond(403, ['error' => 'Insufficient permissions']);
    return $user;
}
