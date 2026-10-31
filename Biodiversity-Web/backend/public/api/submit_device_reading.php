<?php
require_once __DIR__ . '/../../observations.php';
require_once __DIR__ . '/../../threat_detection.php';
api(['POST']);$body=jsonBody();$code=strtoupper(observationText($body,'device_code',64,true));
$key=$_SERVER['HTTP_X_DEVICE_KEY']??'';
if(!is_string($key)||!preg_match('/^[a-f0-9]{64}$/D',$key))respond(401,['error'=>'Invalid device credentials.']);
foreach(['plant_id','species_id','tracking_assignment_id'] as $field)if(isset($body[$field]))respond(400,['error'=>'Device identity determines the assigned plant; omit plant/species IDs.']);
$reading=[];
foreach(['temperature'=>[-999.99,999.99],'humidity'=>[0,100],'distance_cm'=>[0,999999.99],'latitude'=>[-90,90],'longitude'=>[-180,180]] as $field=>[$min,$max]){
    $reading[$field]=observationNumber($body,$field,$min,$max);if($reading[$field]===null)respond(400,['error'=>"Missing $field."]);
}
$db=database();$config=threatConfiguration();
try{
    $db->beginTransaction();
    $q=$db->prepare('SELECT id,key_hash,is_active FROM tracking_devices WHERE device_code=? FOR UPDATE');$q->execute([$code]);$device=$q->fetch();
    if(!$device||!$device['is_active']||!hash_equals($device['key_hash'],hash('sha256',$key))){$db->rollBack();respond(401,['error'=>'Invalid device credentials.']);}
    $q=$db->prepare('SELECT a.id,p.species_id FROM tracking_assignments a JOIN tracked_plants p ON p.id=a.plant_id WHERE a.device_id=? AND a.active_slot=1 FOR UPDATE');$q->execute([$device['id']]);$assignment=$q->fetch();
    if(!$assignment){$db->rollBack();respond(409,['error'=>'Device has no active plant assignment.']);}
    $q=$db->prepare('SELECT distance_cm FROM sensor_readings WHERE tracking_assignment_id=? AND recorded_at>=DATE_SUB(NOW(), INTERVAL '.(int)$config['baseline_max_age_seconds'].' SECOND) ORDER BY reading_id DESC LIMIT 1');$q->execute([$assignment['id']]);$previous=$q->fetch()?:null;
    $q=$db->prepare('INSERT INTO sensor_readings (plant_id,tracking_assignment_id,temperature,humidity,distance_cm,latitude,longitude) VALUES (?,?,?,?,?,?,?)');
    $q->execute([$assignment['species_id'],$assignment['id'],$reading['temperature'],$reading['humidity'],$reading['distance_cm'],$reading['latitude'],$reading['longitude']]);$id=(int)$db->lastInsertId();
    $alerts=storeAutomaticThreats($db,(int)$assignment['species_id'],$reading,detectThreats($reading,$previous,$config),$config,(int)$assignment['id']);
    $db->commit();respond(201,['reading_id'=>$id,'assignment_id'=>(int)$assignment['id'],'automatic_alerts'=>$alerts]);
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
