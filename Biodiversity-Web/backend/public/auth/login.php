<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();

$body = jsonBody();
if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) {
    respond(400, ['error' => 'Email and password are required']);
}
$email = strtolower(trim($body['email']));
$password = $body['password'];
if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 72) {
    respond(400, ['error' => 'Invalid email or password format']);
}
$db = database();
    assertDatabaseKey($db);
$key = emailLookup($email);
$now = time();
// Lock one account row so concurrent requests cannot bypass the attempt limit.
$db->beginTransaction();
$stmt = $db->prepare('INSERT IGNORE INTO auth_login_attempts (account_key, attempts, window_started) VALUES (?, 0, ?)');
$stmt->execute([$key, $now]);
$stmt = $db->prepare('SELECT attempts, window_started FROM auth_login_attempts WHERE account_key = ? FOR UPDATE');
$stmt->execute([$key]);
$attempt = $stmt->fetch();
$attempts = $now - (int) $attempt['window_started'] >= 900 ? 0 : (int) $attempt['attempts'];
$started = $attempts === 0 ? $now : (int) $attempt['window_started'];
if ($attempts >= 5) {
    $db->commit();
    header('Retry-After: ' . max(1, 900 - ($now - $started)));
    respond(429, ['error' => 'Too many login attempts. Try again later.']);
}
$stmt = $db->prepare('SELECT id, name, email, password_hash, role, is_active FROM users WHERE email_lookup = ?');
$stmt->execute([emailLookup($email)]);
$user = $stmt->fetch();
// A valid dummy hash keeps password verification on the unknown-account path.
$hash = $user ? $user['password_hash'] : '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
$valid = password_verify($password, $hash);
if (!$user || !$valid || !$user['is_active']) {
    $stmt = $db->prepare('UPDATE auth_login_attempts SET attempts = ?, window_started = ? WHERE account_key = ?');
    $stmt->execute([$attempts + 1, $started, $key]);
    $db->commit();
    respond(401, ['error' => 'Invalid email or password']);
}
$stmt = $db->prepare('DELETE FROM auth_login_attempts WHERE account_key = ?');
$stmt->execute([$key]);
$db->commit();
$user = revealUser($user);
session_regenerate_id(true);
$_SESSION = ['user_id' => (int) $user['id'], 'role' => $user['role'], 'issued_at' => $now, 'last_seen' => $now];
unset($user['password_hash'], $user['is_active']);
respond(200, ['user' => $user, 'csrf_token' => csrfToken()]);

try {
    // Your existing login logic goes here.
} catch (\Throwable $e) {
    error_log(
        'Login failure: ' . $e->getMessage()
        . ' in ' . $e->getFile()
        . ':' . $e->getLine()
    );

    respond(500, ['error' => 'Internal server error']);
}
