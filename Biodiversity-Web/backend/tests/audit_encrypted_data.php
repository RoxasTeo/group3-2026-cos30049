<?php
require_once __DIR__ . '/../bootstrap.php';
if(PHP_SAPI!=='cli'||setting('REVIEW_TEST_FIXTURES')!=='1'||!str_ends_with(setting('DB_NAME'),'_test')||setting('DB_HOST')!=='127.0.0.1')throw new RuntimeException('Disposable database required.');
$db=database();assertDatabaseKey($db);$count=0;
foreach($db->query('SELECT * FROM users')->fetchAll() as $row){
    $plain=revealUser($row);
    if(!hash_equals(emailLookup($plain['email']),$row['email_lookup'])||$row['name']===$plain['name']||$row['email']===$plain['email'])throw new RuntimeException('Profile protection assertion failed.');
    if(!str_starts_with($row['password_hash'],'$2y$'))throw new RuntimeException('Password hashes changed.');
    $count+=2;
}
foreach($db->query('SELECT submitted_by,client_reference,field_notes,habitat FROM observations')->fetchAll() as $row)foreach(['field_notes','habitat'] as $field){revealData($row[$field],observationSecretContext($row,$field));$count++;}
foreach($db->query('SELECT observation_id,observation_version,reviewer_id,notes FROM observation_reviews')->fetchAll() as $row){revealData($row['notes'],'reviews.notes:'.$row['observation_id'].':'.$row['observation_version'].':'.$row['reviewer_id']);$count++;}
echo "PASS: $count sensitive database fields contain authenticated ciphertext; lookup indexes agree and bcrypt hashes remain intact. No values displayed.\n";
$backups=glob(privateDataPath(setting('DATA_ENCRYPTION_BACKUP_DIR'),true).DIRECTORY_SEPARATOR.'sensitive-*.enc');
if(!$backups)throw new RuntimeException('Encrypted migration backup missing.');
$snapshot=json_decode(revealData(file_get_contents(end($backups)),'migration-backup:'.setting('DB_NAME')),true,512,JSON_THROW_ON_ERROR);
if($snapshot['database']!==setting('DB_NAME')||!isset($snapshot['users'],$snapshot['observations'],$snapshot['reviews']))throw new RuntimeException('Backup verification failed.');
echo "PASS: encrypted migration backup authenticates and parses in memory. No plaintext backup was written.\n";
