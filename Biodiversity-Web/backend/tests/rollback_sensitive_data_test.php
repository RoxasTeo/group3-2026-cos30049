<?php
require_once __DIR__.'/../bootstrap.php';
require_once __DIR__.'/../bin/legacy-field-encryption.php';
if(PHP_SAPI!=='cli'||setting('REVIEW_TEST_FIXTURES')!=='1'||setting('DB_HOST')!=='127.0.0.1'||!str_ends_with(setting('DB_NAME'),'_test'))throw new RuntimeException('Explicit isolated local fixtures required.');
$operator=database();$name='rollback_'.bin2hex(random_bytes(6)).'_test';
$before=glob(privateDataPath(setting('DATA_ENCRYPTION_BACKUP_DIR'),true).'/before-rollback-*.enc');
function verify(bool $condition,string $message):void{if(!$condition)throw new RuntimeException($message);}
function runRollback(string $mode,int $expected):void{
    $process=proc_open([PHP_BINARY,__DIR__.'/../bin/rollback-sensitive-data.php',$mode],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    fclose($pipes[0]);$out=stream_get_contents($pipes[1]);$err=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    verify(proc_close($process)===$expected,'Unexpected rollback result: '.$out.$err);
}
try{
    $operator->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");$operator->exec("USE `$name`");
    $operator->exec(file_get_contents(__DIR__.'/../schema.sql'));
    $operator->exec('ALTER TABLE users DROP INDEX email, MODIFY name TEXT NOT NULL, MODIFY email TEXT NOT NULL, ADD email_lookup CHAR(64) NOT NULL UNIQUE');
    $operator->exec('CREATE TABLE data_protection_state (id TINYINT PRIMARY KEY,key_check TEXT NOT NULL) ENGINE=InnoDB');
    $q=$operator->prepare('INSERT INTO data_protection_state VALUES (1,?)');$q->execute([protectData('niah-sensitive-data-v1','database-key-check')]);
    $hash=password_hash('Rollback-Test-Only-2026!',PASSWORD_BCRYPT);
    $q=$operator->prepare("INSERT INTO users (id,name,email,email_lookup,password_hash,role) VALUES (1,?,?,?,?,'conservation_officer')");
    $q->execute([protectData('Fixture Officer','users.name:1'),protectData('rollback@example.test','users.email:1'),emailLookup('rollback@example.test'),$hash]);
    $q=$operator->prepare("INSERT INTO observations (id,submitted_by,client_reference,plant_tag,common_name,field_notes,habitat,photos,photo_count,status) VALUES (1,1,'rollback-ref','TEST','Fixture plant',?,?,'[]',0,'Approved')");
    $q->execute([protectData('Field notes','observations.field_notes:1:rollback-ref'),protectData('Forest','observations.habitat:1:rollback-ref')]);
    $q=$operator->prepare("INSERT INTO observation_reviews (id,observation_id,reviewer_id,decision,notes,checks,observation_version) VALUES (1,1,1,'Approved',?,'{}',1)");$q->execute([protectData('Accepted','reviews.notes:1:1:1')]);
    putenv('DB_NAME='.$name);putenv('DATA_ENCRYPTION_MAINTENANCE=true');
    // Incorrect original key must fail before any changes or backups.
    $key=setting('DATA_ENCRYPTION_KEY_FILE');putenv('DATA_ENCRYPTION_KEY_FILE='.$key.'.missing');runRollback('--apply',255);putenv('DATA_ENCRYPTION_KEY_FILE='.$key);
    verify(str_starts_with($operator->query('SELECT name FROM users')->fetchColumn(),'enc:v1:'),'Failed preflight changed data');
    runRollback('--check',2);runRollback('--apply',0);runRollback('--check',0);runRollback('--apply',0);
    $user=$operator->query('SELECT * FROM users')->fetch();verify($user['name']==='Fixture Officer'&&$user['email']==='rollback@example.test'&&$user['password_hash']===$hash&&$user['role']==='conservation_officer','Account changed');
    verify($operator->query('SELECT field_notes FROM observations')->fetchColumn()==='Field notes','Observation lost');
    verify($operator->query('SELECT notes FROM observation_reviews')->fetchColumn()==='Accepted','Review lost');
    $q=$operator->prepare("INSERT INTO users(name,email,password_hash,role) VALUES('New','new@example.test',?,'user')");$q->execute([$hash]);
    try{$q->execute([$hash]);throw new RuntimeException('Duplicate email accepted');}catch(PDOException $e){verify(($e->errorInfo[1]??0)===1062,'Wrong unique constraint result');}
    echo "PASS: independent encrypted fixture rollback, missing-key refusal, repeat safety, preserved account/password/relationships, plaintext schema and unique email.\n";
}finally{
    if(preg_match('/^rollback_[a-f0-9]{12}_test$/D',$name))$operator->exec("DROP DATABASE IF EXISTS `$name`");
    foreach(array_diff(glob(privateDataPath(setting('DATA_ENCRYPTION_BACKUP_DIR'),true).'/before-rollback-*.enc'),$before) as $path){
        $data=json_decode(revealData(file_get_contents($path),'migration-backup:'.$name),true,512,JSON_THROW_ON_ERROR);
        if(($data['database']??'')===$name)unlink($path);
    }
}
