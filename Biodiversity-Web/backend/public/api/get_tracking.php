<?php
require_once __DIR__ . '/../../observations.php';
api(['GET']);requireRole(['admin','conservation_officer']);$db=database();
$db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$db->beginTransaction();
$plants=$db->query('SELECT p.*,s.common_name,s.scientific_name FROM tracked_plants p JOIN species s ON s.species_id=p.species_id ORDER BY p.plant_tag LIMIT 1001')->fetchAll();
$devices=$db->query('SELECT d.id,d.device_code,d.name,d.is_active,d.version,a.id AS assignment_id,a.plant_id,a.started_at,r.reading_id,r.latitude,r.longitude,r.temperature,r.humidity,r.distance_cm,r.recorded_at,TIMESTAMPDIFF(SECOND,r.recorded_at,NOW()) AS age_seconds FROM tracking_devices d LEFT JOIN tracking_assignments a ON a.device_id=d.id AND a.active_slot=1 LEFT JOIN sensor_readings r ON r.reading_id=(SELECT MAX(sr.reading_id) FROM sensor_readings sr WHERE sr.tracking_assignment_id=a.id) ORDER BY d.device_code LIMIT 1001')->fetchAll();
$species=$db->query('SELECT species_id,common_name,scientific_name FROM species ORDER BY common_name LIMIT 1001')->fetchAll();
$trail=[];$history=[];
if(isset($_GET['device_id'])){
    $id=observationId($_GET['device_id']);
    $q=$db->prepare('SELECT r.reading_id,r.latitude,r.longitude,r.recorded_at,r.temperature,r.humidity FROM sensor_readings r JOIN tracking_assignments a ON a.id=r.tracking_assignment_id WHERE a.device_id=? AND a.active_slot=1 ORDER BY r.reading_id DESC LIMIT 100');$q->execute([$id]);$trail=array_reverse($q->fetchAll());
    $q=$db->prepare('SELECT a.id,a.plant_id,p.plant_tag,a.started_at,a.ended_at FROM tracking_assignments a JOIN tracked_plants p ON p.id=a.plant_id WHERE a.device_id=? ORDER BY a.id DESC LIMIT 100');$q->execute([$id]);$history=$q->fetchAll();
}
$db->commit();
respond(200,['plants'=>array_slice($plants,0,1000),'devices'=>array_slice($devices,0,1000),'species'=>array_slice($species,0,1000),'limited'=>count($plants)>1000||count($devices)>1000||count($species)>1000,'trail'=>$trail,'assignments'=>$history]);
