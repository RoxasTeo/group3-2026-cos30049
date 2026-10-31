<?php
// One-time operator rollback for databases encrypted by migration 005.
// This file and its legacy cipher helper are not loaded by Web requests.
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/legacy-field-encryption.php';
if (PHP_SAPI !== 'cli' || !in_array($argv[1] ?? '', ['--check', '--apply'], true)) {
    fwrite(STDERR, "Usage: php rollback-sensitive-data.php --check|--apply\nStop every writer, retain the original key and back up the full database first.\n"); exit(1);
}
$db = database();
if ((int)$db->query("SELECT GET_LOCK('niah_sensitive_data_migration',10)")->fetchColumn() !== 1) throw new RuntimeException('Another migration is running.');
try {
    $hasLookup = (int)$db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_lookup'")->fetchColumn();
    $hasState = (int)$db->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='data_protection_state'")->fetchColumn();
    if (!$hasLookup && !$hasState) {
        foreach (['users'=>['name','email'],'observations'=>['field_notes','habitat'],'observation_reviews'=>['notes']] as $table=>$fields) {
            foreach ($fields as $field) if ($db->query("SELECT COUNT(*) FROM $table WHERE $field LIKE 'enc:v1:%'")->fetchColumn()) throw new RuntimeException('Unexpected ciphertext remains; operator investigation required.');
        }
        echo "No encryption schema or ciphertext remains. No changes made.\n"; exit(0);
    }
    if ($hasState) assertDatabaseKey($db);
    $db->beginTransaction();
    // All writers must already be stopped; lock existing rows during conversion.
    $users=$db->query('SELECT * FROM users ORDER BY id FOR UPDATE')->fetchAll();
    $observations=$db->query('SELECT id,submitted_by,client_reference,field_notes,habitat FROM observations ORDER BY id FOR UPDATE')->fetchAll();
    $reviews=$db->query('SELECT id,observation_id,observation_version,reviewer_id,notes FROM observation_reviews ORDER BY id FOR UPDATE')->fetchAll();
    $decode=fn(string $value,string $context):string=>str_starts_with($value,'enc:v1:')?revealData($value,$context):$value;
    $emails=[];
    foreach($users as &$row){
        $row['name']=$decode($row['name'],'users.name:'.$row['id']);
        $row['email']=$decode($row['email'],'users.email:'.$row['id']);
        if(strlen($row['name'])>120||strlen($row['email'])>254||!filter_var($row['email'],FILTER_VALIDATE_EMAIL))throw new RuntimeException('Profile does not fit the legacy schema. No data changed.');
        $email=strtolower($row['email']);if(isset($emails[$email]))throw new RuntimeException('Duplicate email. No data changed.');$emails[$email]=true;
    }unset($row);
    foreach($observations as &$row)foreach(['field_notes','habitat'] as $field)$row[$field]=$decode($row[$field],observationSecretContext($row,$field));unset($row);
    foreach($reviews as &$row)$row['notes']=$decode($row['notes'],'reviews.notes:'.$row['observation_id'].':'.$row['observation_version'].':'.$row['reviewer_id']);unset($row);
    if($argv[1]==='--check'){$db->rollBack();echo "Original key and field conversion verified. Rollback pending.\n";exit(2);}
    if(setting('DATA_ENCRYPTION_MAINTENANCE')!=='true')throw new RuntimeException('Maintenance acknowledgement required; stop all services first.');
    $snapshot=json_encode(['database'=>setting('DB_NAME'),'users'=>$users,'observations'=>$observations,'reviews'=>$reviews],JSON_THROW_ON_ERROR);
    $backup=protectData($snapshot,'migration-backup:'.setting('DB_NAME'));
    if(revealData($backup,'migration-backup:'.setting('DB_NAME'))!==$snapshot)throw new RuntimeException('Backup verification failed.');
    $path=privateDataPath(setting('DATA_ENCRYPTION_BACKUP_DIR'),true).DIRECTORY_SEPARATOR.'before-rollback-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.enc';
    $file=fopen($path,'xb');if(!$file)throw new RuntimeException('Cannot create backup.');chmod($path,0600);
    if(fwrite($file,$backup)!==strlen($backup)){fclose($file);throw new RuntimeException('Incomplete backup.');}fclose($file);
    if(file_get_contents($path)!==$backup)throw new RuntimeException('Backup read-back failed.');
    $q=$db->prepare('UPDATE users SET name=?,email=? WHERE id=?');foreach($users as $row)$q->execute([$row['name'],$row['email'],$row['id']]);
    $q=$db->prepare('UPDATE observations SET field_notes=?,habitat=? WHERE id=?');foreach($observations as $row)$q->execute([$row['field_notes'],$row['habitat'],$row['id']]);
    $q=$db->prepare('UPDATE observation_reviews SET notes=? WHERE id=?');foreach($reviews as $row)$q->execute([$row['notes'],$row['id']]);
    $db->exec('DELETE FROM auth_login_attempts');
    $db->commit();
    // MySQL DDL commits independently. A failed schema step can be retried with the same key.
    $indexes=$db->query("SHOW INDEX FROM users WHERE Column_name='email'")->fetchAll();
    $unique=false;foreach($indexes as $index)if((int)$index['Non_unique']===0)$unique=true;
    $db->exec('ALTER TABLE users MODIFY name VARCHAR(120) NOT NULL, MODIFY email VARCHAR(254) NOT NULL');
    if(!$unique)$db->exec('ALTER TABLE users ADD UNIQUE KEY users_email_plain (email)');
    if($hasLookup)$db->exec('ALTER TABLE users DROP COLUMN email_lookup');
    if($hasState)$db->exec('DROP TABLE data_protection_state');
    echo "Rollback completed. Profiles and observation/review text use the legacy format. IDs, password hashes, roles and business relationships preserved. Private encrypted snapshot retained.\n";
}catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
finally{$db->query("SELECT RELEASE_LOCK('niah_sensitive_data_migration')");}
