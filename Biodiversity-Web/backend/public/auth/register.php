<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);
requireCsrf();

$data = jsonBody();
foreach (['name', 'email', 'password'] as $field) {
    if (!is_string($data[$field] ?? null)) respond(400, ['error' => 'Name, email and password must be strings.']);
}
$name = trim($data['name']);
$email = strtolower(trim($data['email']));
$password = $data['password'];

// Hierarchical default role configuration assignment rule
$role = 'user'; 

if ($name === '' || preg_match_all('/./us', $name) > 120) {
    respond(400, ['error' => 'Name is required and must be under 120 characters.']);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    respond(400, ['error' => 'Invalid email address format.']);
}
if (strlen($password) < 12 || strlen($password) > 72) {
    respond(400, ['error' => 'Password must be between 12 and 72 characters long.']);
}

try {
    $db = database();

    // Confirm email uniquely satisfies system structural expectations
    $check = $db->prepare('SELECT id FROM users WHERE email = ?');
    $check->execute([$email]);
    if ($check->fetch()) {
        respond(409, ['error' => 'An account with this email address already exists.']);
    }

    // Hash the password with bcrypt; never store the password itself.
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

    $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    $stmt->execute([$name, $email, $hashedPassword, $role]);

    respond(201, ['success' => 'Account created successfully!']);
} catch (\Throwable $e) {
    if ($e instanceof PDOException && ($e->errorInfo[1] ?? null) === 1062) respond(409, ['error' => 'An account with this email address already exists.']);
    error_log('Registration database failure. Inspect database configuration privately.');
    respond(500, ['error' => 'Internal server error']);
}