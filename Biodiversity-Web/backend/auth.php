<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

// Shared by the Web session login and the mobile token login so both enforce the same throttle.
// Returns the active user without its password hash, or responds 400/401/429.
function verifyCredentials(PDO $db, array $body): array {
    if (!is_string($body['email'] ?? null) || !is_string($body['password'] ?? null)) {
        respond(400, ['error' => 'Email and password are required']);
    }
    $email = strtolower(trim($body['email']));
    $password = $body['password'];
    if (strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '' || strlen($password) > 72) {
        respond(400, ['error' => 'Invalid email or password format']);
    }
    requireFirstAccount($db);
    assertDatabaseKey($db);
    // Keyed lookup: neither the email nor an unkeyed hash of it is stored.
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
    $stmt->execute([$key]);
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
    unset($user['is_active']);
    $user['id'] = (int) $user['id'];
    return $user;
}
