<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);

requireRole(['admin']);
requireCsrf();


$body = jsonBody();
foreach (['name', 'email', 'password', 'role'] as $field) {
    if (!is_string($body[$field] ?? null)) respond(400, ['error' => 'Name, email, password and role must be strings.']);
}
$name = trim($body['name']);
$email = strtolower(trim($body['email']));
$password = $body['password'];
$role = trim($body['role']);
if ($name === '' || preg_match_all('/./us', $name) > 120 || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 12 || strlen($password) > 72) {
    respond(400, ['error' => 'Provide a name, valid email and a password of 12-72 bytes.']);
}

$valid_system_roles = ['conservation_officer', 'botanist', 'user'];
if (!in_array($role, $valid_system_roles, true)) {
    respond(400, ['error' => 'Invalid account role type specified.']);
}


$db = database();
try {
    // Check if the email address is already registered inside your system
    $stmt = $db->prepare("SELECT id FROM users WHERE email_lookup = ?");
    $stmt->execute([emailLookup($email)]);
    if ($stmt->fetch()) {
        respond(409, ['error' => 'An account with this email address already exists.']);
    }

    // Cryptographically hash the password matching your login.php password_verify match engine
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // Name and email are stored encrypted.
    createProtectedUser($db, $name, $email, $password_hash, $role);

    respond(200, ['status' => 'success', 'message' => 'New user profile successfully registered.']);

} catch (\PDOException $e) {
    if (($e->errorInfo[1] ?? null) === 1062) respond(409, ['error' => 'An account with this email address already exists.']);
    error_log('User Insertion Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database storage operational registry failure.']);
}
