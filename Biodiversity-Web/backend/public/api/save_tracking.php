<?php
require_once __DIR__ . '/../../observations.php';
api(['POST']); requireRole(['admin','conservation_officer']); requireCsrf();
$body=jsonBody(); $action=observationText($body,'action',30,true); $db=database();
if (!in_array($action,['plant','device','assign','unassign','rotate_key'],true)) respond(400,['error'=>'Invalid tracking action.']);
$id=isset($body['id'])?observationId($body['id']):null;
if ($id!==null) $version=observationId($body['version']??null);
if ($action==='plant') {
    $tag=strtoupper(observationText($body,'plant_tag',64,true));$label=observationText($body,'label',120,true);$species=observationId($body['species_id']??null);
    if(!preg_match('/^[A-Z0-9][A-Z0-9_-]{2,63}$/D',$tag))respond(400,['error'=>'Plant tag must contain 3-64 letters, numbers, hyphens or underscores.']);
    $lat=observationNumber($body,'latitude',-90,90);$lng=observationNumber($body,'longitude',-180,180);
    if(($lat===null)!==($lng===null))respond(400,['error'=>'Provide both coordinates or neither.']);
} elseif($action==='device') {
    $code=strtoupper(observationText($body,'device_code',64,true));$name=observationText($body,'name',120,true);
    if(!preg_match('/^[A-Z0-9][A-Z0-9_-]{2,63}$/D',$code)||!is_bool($body['is_active']??null))respond(400,['error'=>'Provide a valid device code and active flag.']);
}
try {
    $db->beginTransaction();$key=null;
    if($action==='plant') {
        if($id!==null){$q=$db->prepare('SELECT version, species_id FROM tracked_plants WHERE id=? FOR UPDATE');$q->execute([$id]);$old=$q->fetch();if(!$old){$db->rollBack();respond(404,['error'=>'Plant not found.']);}if((int)$old['version']!==$version){$db->rollBack();respond(409,['error'=>'Plant changed. Reload before saving.']);}if((int)$old['species_id']!==$species){$db->rollBack();respond(400,['error'=>'Species identification is fixed for a tracked plant; create a separate plant to change it.']);}}
        $q=$db->prepare('SELECT species_id FROM species WHERE species_id=?');$q->execute([$species]);if(!$q->fetch()){$db->rollBack();respond(400,['error'=>'Species not found.']);}
        if($id===null){$q=$db->prepare('INSERT INTO tracked_plants (species_id,plant_tag,label,latitude,longitude) VALUES (?,?,?,?,?)');$q->execute([$species,$tag,$label,$lat,$lng]);$id=(int)$db->lastInsertId();}
        else{$q=$db->prepare('UPDATE tracked_plants SET plant_tag=?,label=?,latitude=?,longitude=?,version=version+1 WHERE id=?');$q->execute([$tag,$label,$lat,$lng,$id]);}
    } else {
        if($id!==null){$q=$db->prepare('SELECT version FROM tracking_devices WHERE id=? FOR UPDATE');$q->execute([$id]);$old=$q->fetch();if(!$old){$db->rollBack();respond(404,['error'=>'Device not found.']);}if((int)$old['version']!==$version){$db->rollBack();respond(409,['error'=>'Device changed. Reload before saving.']);}}
        if($action==='device'&&$id===null){$key=bin2hex(random_bytes(32));$q=$db->prepare('INSERT INTO tracking_devices (device_code,name,key_hash,is_active) VALUES (?,?,?,?)');$q->execute([$code,$name,hash('sha256',$key),(int)$body['is_active']]);$id=(int)$db->lastInsertId();}
        elseif($action==='device'){$q=$db->prepare('UPDATE tracking_devices SET device_code=?,name=?,is_active=?,version=version+1 WHERE id=?');$q->execute([$code,$name,(int)$body['is_active'],$id]);}
        elseif($id===null){$db->rollBack();respond(400,['error'=>'Choose a device.']);}
        else {
            if($action==='rotate_key'){$key=bin2hex(random_bytes(32));$q=$db->prepare('UPDATE tracking_devices SET key_hash=? WHERE id=?');$q->execute([hash('sha256',$key),$id]);}
            else {
                if($action==='assign'){$plant=observationId($body['plant_id']??null);$q=$db->prepare('SELECT id FROM tracked_plants WHERE id=?');$q->execute([$plant]);if(!$q->fetch()){$db->rollBack();respond(400,['error'=>'Plant not found.']);}}
                $q=$db->prepare('SELECT plant_id FROM tracking_assignments WHERE device_id=? AND active_slot=1');$q->execute([$id]);$current=$q->fetchColumn();
                if($action==='assign'&&(int)$current===$plant){$db->rollBack();respond(409,['error'=>'Device is already assigned to this plant.']);}
                $q=$db->prepare('UPDATE tracking_assignments SET active_slot=NULL,ended_at=CURRENT_TIMESTAMP WHERE device_id=? AND active_slot=1');$q->execute([$id]);
                if($action==='assign'){$q=$db->prepare('INSERT INTO tracking_assignments (device_id,plant_id) VALUES (?,?)');$q->execute([$id,$plant]);}
            }
            $q=$db->prepare('UPDATE tracking_devices SET version=version+1 WHERE id=?');$q->execute([$id]);
        }
    }
    $db->commit();respond(200,['id'=>$id,'device_key'=>$key]);
}catch(Throwable $e){if($db->inTransaction())$db->rollBack();if($e instanceof PDOException&&($e->errorInfo[1]??null)===1062)respond(409,['error'=>'Plant tag or device code already exists.']);throw $e;}
