<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);
requireCsrf();

$data = jsonBody();
$name = trim((string) ($data['name'] ?? ''));
$email = strtolower(trim((string) ($data['email'] ?? '')));
$password = (string) ($data['password'] ?? '');

// Hierarchical default role configuration assignment rule
$role = 'user'; 

if ($name === '' || mb_strlen($name, 'UTF-8') > 120) {
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

    // Secure encryption hashing transformation algorithm
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

    $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    $stmt->execute([$name, $email, $hashedPassword, $role]);

    respond(201, ['success' => 'Account created successfully!']);
} catch (\Throwable $e) {
    error_log('Critical registration database failure: ' . $e->getMessage());
    respond(500, ['error' => 'Internal server error occurred while processing registration.']);
}