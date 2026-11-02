<?php
require_once __DIR__ . '/../bootstrap.php';
if(PHP_SAPI!=='cli'||count($argv)!==3||$argv[2]!=='--apply'){fwrite(STDERR,"Usage: php restore-sensitive-data.php <private-encrypted-backup> --apply\nRestores protected fields only, not an entire database. Maintenance mode required.\n");exit(1);}
if(setting('DATA_ENCRYPTION_MAINTENANCE')!=='true')throw new RuntimeException('Maintenance mode required.');
$path=privateDataPath($argv[1]);
$data=json_decode(revealData(file_get_contents($path),'migration-backup:'.setting('DB_NAME')),true,512,JSON_THROW_ON_ERROR);
if(($data['database']??null)!==setting('DB_NAME')||!isset($data['users'],$data['observations'],$data['reviews']))throw new RuntimeException('Backup does not belong to this database.');
$db=database();assertDatabaseKey($db);
if((int)$db->query("SELECT GET_LOCK('niah_sensitive_data_migration',10)")->fetchColumn()!==1)throw new RuntimeException('Another migration is running.');
try{
    $db->beginTransaction();
    foreach(['users'=>'users','observations'=>'observations','reviews'=>'observation_reviews'] as $group=>$table){
        $check=$db->prepare("SELECT * FROM $table WHERE id=? FOR UPDATE");
        foreach($data[$group] as $row){
            $check->execute([$row['id']]);$current=$check->fetch();
            if(!$current)throw new RuntimeException('A backup row no longer exists; restore was cancelled.');
            $identity=$group==='observations'?['submitted_by','client_reference']:($group==='reviews'?['observation_id','observation_version','reviewer_id']:[]);
            foreach($identity as $field)if((string)$current[$field]!== (string)$row[$field])throw new RuntimeException('A protected row identity changed; restore was cancelled.');
        }
    }
    $q=$db->prepare('UPDATE users SET name=?,email=?,email_lookup=? WHERE id=?');
    foreach($data['users'] as $row)$q->execute([protectData($row['name'],'users.name:'.$row['id']),protectData($row['email'],'users.email:'.$row['id']),emailLookup($row['email']),$row['id']]);
    $q=$db->prepare('UPDATE observations SET field_notes=?,habitat=? WHERE id=?');
    foreach($data['observations'] as $row)$q->execute([protectData($row['field_notes'],observationSecretContext($row,'field_notes')),protectData($row['habitat'],observationSecretContext($row,'habitat')),$row['id']]);
    $q=$db->prepare('UPDATE observation_reviews SET notes=? WHERE id=?');
    foreach($data['reviews'] as $row)$q->execute([protectData($row['notes'],'reviews.notes:'.$row['observation_id'].':'.$row['observation_version'].':'.$row['reviewer_id']),$row['id']]);
    $db->commit();echo "Sensitive fields restored as ciphertext. Password hashes, decisions, unrelated fields and newer rows were not overwritten.\n";
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
finally{$db->query("SELECT RELEASE_LOCK('niah_sensitive_data_migration')");}
