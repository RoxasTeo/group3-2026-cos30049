<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    respond(403, ['error' => 'Access Denied: Administrative credentials required.']);
}

$body = jsonBody();
$name = trim($body['name'] ?? '');
$email = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';
$role = trim($body['role'] ?? ''); 

if (empty($name) || empty($email) || empty($password) || empty($role)) {
    respond(400, ['error' => 'All fields are mandatory: name, email, password, and role are required.']);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Invalid email address format.']);
}

$valid_system_roles = ['conservation_officer', 'botanist', 'user'];
if (!in_array($role, $valid_system_roles, true)) {
    respond(400, ['error' => 'Invalid account role type specified.']);
}


$db = database();
try {
    // Check if the email address is already registered inside your system
    $stmt = $db->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        respond(409, ['error' => 'An account with this email address already exists.']);
    }

    // Cryptographically hash the password matching your login.php password_verify match engine
    $password_hash = password_hash($password, PASSWORD_BCRYPT);

    // 5. Execute safe prepared insertion query statement
    $sql = "INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)";
    $stmt = $db->prepare($sql);
    $stmt->execute([$name, $email, $password_hash, $role]);

    respond(200, ['status' => 'success', 'message' => 'New user profile successfully registered.']);

} catch (\PDOException $e) {
    error_log('User Insertion Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database storage operational registry failure.']);
}
