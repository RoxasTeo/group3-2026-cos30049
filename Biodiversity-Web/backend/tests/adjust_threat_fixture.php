<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable database required.');
$id = filter_var($argv[1] ?? null, FILTER_VALIDATE_INT); $action=$argv[2] ?? '';
$db=database(); $stmt=$db->prepare('SELECT common_name FROM species WHERE species_id=?');$stmt->execute([$id]);
if (!str_starts_with((string)$stmt->fetchColumn(),'Monitoring acceptance threat ')) throw new RuntimeException('Not a threat fixture.');
if ($action==='install_failure') { $db->exec("CREATE TRIGGER threat_fixture_failure_$id BEFORE INSERT ON threat_alerts FOR EACH ROW BEGIN IF NEW.plant_id = $id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Fixture insertion failure'; END IF; END"); exit; }
if ($action==='remove_failure') { $db->exec("DROP TRIGGER IF EXISTS threat_fixture_failure_$id"); exit; }
if ($action==='expire_alerts') $sql='UPDATE threat_alerts SET created_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE plant_id=?';
elseif($action==='expire_readings') $sql='UPDATE sensor_readings SET recorded_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE plant_id=?';
else throw new RuntimeException('Invalid fixture action.');
$stmt=$db->prepare($sql);$stmt->execute([$id]);
