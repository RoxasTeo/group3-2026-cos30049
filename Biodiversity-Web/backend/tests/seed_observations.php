<?php
// Explicitly opt-in fixtures for a disposable local database, never deployment data.
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' ||
    !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') {
    throw new RuntimeException('Use REVIEW_TEST_FIXTURES=1 with a disposable loopback *_test database.');
}
$db = database();
$sql = file_get_contents(__DIR__ . '/../schema.sql');
$sql = preg_replace('/(?:CREATE DATABASE IF NOT EXISTS biodiversity_db|USE biodiversity_db);/i', '', $sql);
$db->exec($sql);
$hash = password_hash('Review-Test-Only-2026!', PASSWORD_BCRYPT);
foreach (['officer' => 'conservation_officer', 'admin' => 'admin', 'botanist' => 'botanist', 'other-botanist' => 'botanist', 'user' => 'user'] as $name => $role) {
    $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_active = TRUE');
    $stmt->execute([ucwords(str_replace('-', ' ', $name)), "$name@review.test", $hash, $role]);
}
echo "Disposable review fixtures ready.\n";
