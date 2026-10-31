<?php
require_once __DIR__ . '/../bootstrap.php';
if(PHP_SAPI!=='cli'||setting('REVIEW_TEST_FIXTURES')!=='1'||!str_ends_with(setting('DB_NAME'),'_test')||setting('DB_HOST')!=='127.0.0.1')throw new RuntimeException('Test database required.');
$id=filter_var($argv[1]??null,FILTER_VALIDATE_INT);$db=database();$q=$db->prepare('SELECT common_name FROM species WHERE species_id=?');$q->execute([$id]);if(!str_starts_with((string)$q->fetchColumn(),'Tracking acceptance '))throw new RuntimeException('Not a tracking fixture.');
$db->beginTransaction();
foreach(['sensor_readings','threat_alerts']as$table){$q=$db->prepare("DELETE FROM $table WHERE plant_id=?");$q->execute([$id]);}
$q=$db->prepare('SELECT DISTINCT a.device_id FROM tracking_assignments a JOIN tracked_plants p ON p.id=a.plant_id WHERE p.species_id=?');$q->execute([$id]);$devices=$q->fetchAll(PDO::FETCH_COLUMN);
$q=$db->prepare('DELETE a FROM tracking_assignments a JOIN tracked_plants p ON p.id=a.plant_id WHERE p.species_id=?');$q->execute([$id]);
foreach($devices as$device){$q=$db->prepare('DELETE FROM tracking_devices WHERE id=? AND device_code LIKE ?');$q->execute([$device,'TRACK-TEST-%']);}
$q=$db->prepare('DELETE FROM tracked_plants WHERE species_id=?');$q->execute([$id]);
$q=$db->prepare('DELETE FROM species WHERE species_id=?');$q->execute([$id]);$db->commit();
