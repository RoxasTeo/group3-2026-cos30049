<?php
declare(strict_types=1);
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
[$script, $email, $name, $role] = array_pad($argv, 4, '');
$email = strtolower(trim($email));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || trim($name) === '' || strlen($name) > 120 || !in_array($role, ['conservation_officer', 'botanist', 'admin'], true)) {
    fwrite(STDERR, "Usage: php backend/bin/create-user.php email name conservation_officer|botanist|admin\nPassword is read from standard input; use a private terminal.\n");
    exit(1);
}
fwrite(STDERR, "Password (12-72 bytes, input may be visible): ");
$password = rtrim(fgets(STDIN) ?: '', "\r\n");
if (strlen($password) < 12 || strlen($password) > 72) {
    fwrite(STDERR, "Password must be 12-72 bytes.\n"); exit(1);
}
// The first CLI-provisioned account on an empty database initializes the encryption key check.
createProtectedUser(database(), trim($name), $email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]), $role);
echo "User created.\n";
