<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || !in_array($argv[1] ?? '', ['--check','--apply'], true)) { fwrite(STDERR,"Usage: php encrypt-sensitive-data.php --check|--apply\nStop application writers and set DATA_ENCRYPTION_MAINTENANCE=true before --apply.\n"); exit(1); }
sensitiveKeys();
$db = database();
$lock = $db->query("SELECT GET_LOCK('niah_sensitive_data_migration',10)")->fetchColumn();
if ((int) $lock !== 1) throw new RuntimeException('Another data migration is running.');
try {
    $stateTable = $db->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='data_protection_state'")->fetchColumn();
    $hasState = $stateTable && $db->query('SELECT COUNT(*) FROM data_protection_state WHERE id=1')->fetchColumn();
    if ($hasState) assertDatabaseKey($db);
    $users = $db->query('SELECT * FROM users ORDER BY id')->fetchAll();
    $observations = $db->query('SELECT id,submitted_by,client_reference,field_notes,habitat FROM observations ORDER BY id')->fetchAll();
    $reviews = $db->query('SELECT id,observation_id,observation_version,reviewer_id,notes FROM observation_reviews ORDER BY id')->fetchAll();
    $plainCount = 0;
    $convert = function(string $value, string $context) use (&$plainCount): string {
        if (str_starts_with($value,'enc:v1:')) return revealData($value,$context);
        $plainCount++; return $value;
    };
    foreach ($users as &$user) {
        $wasEncrypted = str_starts_with($user['email'],'enc:v1:');
        $user['name'] = $convert($user['name'],'users.name:'.$user['id']);
        $user['email'] = $convert($user['email'],'users.email:'.$user['id']);
        if ($wasEncrypted && (!isset($user['email_lookup']) || !hash_equals(emailLookup($user['email']),$user['email_lookup']))) throw new RuntimeException('An encrypted email lookup is inconsistent. No data changed.');
        if (!filter_var($user['email'],FILTER_VALIDATE_EMAIL)) throw new RuntimeException('A user email needs operator correction. No data changed.');
    } unset($user);
    foreach ($observations as &$row) foreach (['field_notes','habitat'] as $field) $row[$field]=$convert($row[$field],observationSecretContext($row,$field)); unset($row);
    foreach ($reviews as &$row) $row['notes']=$convert($row['notes'],'reviews.notes:'.$row['observation_id'].':'.$row['observation_version'].':'.$row['reviewer_id']); unset($row);
    echo 'Users: '.count($users).'; observations: '.count($observations).'; reviews: '.count($reviews).'; plaintext fields: '.$plainCount."\n";
    if ($argv[1] === '--check') {
        $ready=$db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_lookup' AND IS_NULLABLE='NO'")->fetchColumn();
        exit($plainCount === 0 && $ready && $hasState ? 0 : 2);
    }
    if (setting('DATA_ENCRYPTION_MAINTENANCE') !== 'true') throw new RuntimeException('Maintenance mode is required before migration.');
    $backupDir=privateDataPath(setting('DATA_ENCRYPTION_BACKUP_DIR'),true);
    $snapshot=json_encode(['database'=>setting('DB_NAME'),'users'=>$users,'observations'=>$observations,'reviews'=>$reviews],JSON_THROW_ON_ERROR);
    $backup=protectData($snapshot,'migration-backup:'.setting('DB_NAME'));
    // Verify the backup before DDL or updates; never write a plaintext dump.
    if (revealData($backup,'migration-backup:'.setting('DB_NAME')) !== $snapshot) throw new RuntimeException('Backup verification failed.');
    $path=$backupDir.DIRECTORY_SEPARATOR.'sensitive-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.enc';
    $file=fopen($path,'xb');if(!$file)throw new RuntimeException('Cannot create private backup.');chmod($path,0600);
    if(fwrite($file,$backup)!==strlen($backup)){fclose($file);throw new RuntimeException('Backup incomplete. No database fields changed.');}fclose($file);
    $column=$db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='email_lookup'")->fetchColumn();
    if (!$column) $db->exec('ALTER TABLE users ADD COLUMN email_lookup CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD UNIQUE KEY users_email_lookup (email_lookup)');
    $indexes=$db->query("SHOW INDEX FROM users WHERE Column_name='email'")->fetchAll();
    foreach($indexes as $index){$name=str_replace('`','``',$index['Key_name']);$db->exec("ALTER TABLE users DROP INDEX `$name`");}
    $db->exec('ALTER TABLE users MODIFY name TEXT NOT NULL, MODIFY email TEXT NOT NULL');
    $db->exec('CREATE TABLE IF NOT EXISTS data_protection_state (id TINYINT PRIMARY KEY,key_check TEXT NOT NULL) ENGINE=InnoDB');
    $db->beginTransaction();
    try {
        $q=$db->prepare('UPDATE users SET name=?,email=?,email_lookup=? WHERE id=?');
        foreach($users as $user)$q->execute([protectData($user['name'],'users.name:'.$user['id']),protectData($user['email'],'users.email:'.$user['id']),emailLookup($user['email']),$user['id']]);
        $q=$db->prepare('UPDATE observations SET field_notes=?,habitat=? WHERE id=?');
        foreach($observations as $row)$q->execute([protectData($row['field_notes'],observationSecretContext($row,'field_notes')),protectData($row['habitat'],observationSecretContext($row,'habitat')),$row['id']]);
        $q=$db->prepare('UPDATE observation_reviews SET notes=? WHERE id=?');
        foreach($reviews as $row)$q->execute([protectData($row['notes'],'reviews.notes:'.$row['observation_id'].':'.$row['observation_version'].':'.$row['reviewer_id']),$row['id']]);
        // One-time maintenance resets old unkeyed throttling identifiers. New attempts use keyed indexes.
        $db->exec('DELETE FROM auth_login_attempts');
        $state=$db->prepare('INSERT INTO data_protection_state (id,key_check) VALUES (1,?) ON DUPLICATE KEY UPDATE key_check=VALUES(key_check)');
        $state->execute([protectData('niah-sensitive-data-v1','database-key-check')]);
        $db->commit();
    } catch(Throwable $error) { if($db->inTransaction())$db->rollBack();throw $error; }
    $db->exec('ALTER TABLE users MODIFY email_lookup CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL');
    echo "Sensitive fields encrypted and backup verified. IDs, password hashes and relationships were preserved.\n";
} finally { $db->query("SELECT RELEASE_LOCK('niah_sensitive_data_migration')"); }
