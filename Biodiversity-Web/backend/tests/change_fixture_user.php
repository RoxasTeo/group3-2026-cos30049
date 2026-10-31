<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable local test database required.');
[$script, $account, $role, $active] = $argv;
if (!in_array($account, ['botanist', 'officer'], true) || !in_array($role, ['botanist', 'conservation_officer', 'user'], true) || !in_array($active, ['0', '1'], true)) throw new RuntimeException('Invalid fixture change.');
$stmt = database()->prepare('UPDATE users SET role = ?, is_active = ? WHERE email_lookup = ?');
$stmt->execute([$role, (int) $active, emailLookup("$account@review.test")]);
