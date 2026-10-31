<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable database required.');
$db = database();
$stmt = $db->prepare('INSERT INTO species (common_name, scientific_name, family, description) VALUES (?, ?, ?, ?)');
$stmt->execute(['Monitoring acceptance history ' . bin2hex(random_bytes(5)), 'Historia test', 'Testaceae', 'Fictional historical measurements']);
$id = (int) $db->lastInsertId();
$stmt = $db->prepare('INSERT INTO sensor_readings (plant_id, temperature, humidity, distance_cm, latitude, longitude, recorded_at) VALUES (?, ?, ?, 10, 3.81, 113.78, ?)');
for ($i = 0; $i < 52; $i++) $stmt->execute([$id, 20, 60, '2026-10-10 00:00:' . str_pad((string) $i, 2, '0', STR_PAD_LEFT)]);
foreach ([['2026-10-09 23:59:59', 99, 99], ['2026-10-11 00:00:00', 30, 80], ['2026-10-11 23:59:59', 30, 80], ['2026-10-13 12:00:00', 40, 90], ['2026-10-14 00:00:00', 99, 99]] as [$at, $temp, $humidity]) $stmt->execute([$id, $temp, $humidity, $at]);
echo $id;
