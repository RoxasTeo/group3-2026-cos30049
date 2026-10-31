<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable database required.');
$id = filter_var($argv[1] ?? null, FILTER_VALIDATE_INT);
$db = database();
$stmt = $db->prepare('SELECT common_name FROM species WHERE species_id = ?');
$stmt->execute([$id]);
if (!str_starts_with((string) $stmt->fetchColumn(), 'Monitoring acceptance ')) throw new RuntimeException('Not a monitoring fixture.');
foreach (['sensor_readings', 'threat_alerts'] as $table) { $stmt = $db->prepare("DELETE FROM $table WHERE plant_id = ?"); $stmt->execute([$id]); }
$stmt = $db->prepare('DELETE FROM species WHERE species_id = ?'); $stmt->execute([$id]);
