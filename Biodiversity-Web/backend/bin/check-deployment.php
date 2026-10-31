<?php
// Read-only operator check. Never expose this script through the public web root.
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli') exit(1);
$failures = [];
if (setting('APP_ENV') !== 'production') $failures[] = 'APP_ENV must be production.';
if (setting('COOKIE_SECURE', 'true') !== 'true') $failures[] = 'Secure session cookies are required.';
if (!str_starts_with(setting('APP_ORIGIN'), 'https://')) $failures[] = 'APP_ORIGIN must use HTTPS.';
if (setting('DB_USER') === '' || setting('DB_USER') === 'root') $failures[] = 'A dedicated application database user is required.';
if (setting('DB_PASSWORD') === '') $failures[] = 'A database password is required.';
foreach (['SESSION_IDLE_SECONDS', 'SESSION_MAX_SECONDS'] as $name) {
    if (filter_var(setting($name, $name === 'SESSION_IDLE_SECONDS' ? '1800' : '28800'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) $failures[] = "$name must be a positive integer.";
}
try {
    $db = database();
    $tables = ['users', 'auth_login_attempts', 'species', 'observations', 'observation_reviews', 'sensor_readings', 'threat_alerts', 'tracked_plants', 'tracking_devices', 'tracking_assignments'];
    foreach ($tables as $table) {
        $stmt = $db->prepare('SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?');
        $stmt->execute([$table]);
        if ($stmt->fetchColumn() !== 'InnoDB') $failures[] = "$table must exist and use InnoDB.";
    }
} catch (Throwable $error) { $failures[] = 'Database connection, TLS or schema check failed. Inspect private server logs.'; }
foreach ($failures as $failure) fwrite(STDERR, "FAIL: $failure\n");
echo "Manual evidence still required: live HTTPS/certificate, cloud disk/database and backup encryption, least-privilege grants, restore test, external vulnerability scan.\n";
if ($failures) exit(1);
echo "PASS: application configuration and required database tables. Manual deployment evidence is not certified by this check.\n";
