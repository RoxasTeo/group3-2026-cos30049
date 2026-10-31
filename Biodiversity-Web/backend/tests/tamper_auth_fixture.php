<?php
require_once __DIR__ . '/../bootstrap.php';
if(PHP_SAPI!=='cli'||setting('REVIEW_TEST_FIXTURES')!=='1'||!str_ends_with(setting('DB_NAME'),'_test')||setting('DB_HOST')!=='127.0.0.1')throw new RuntimeException('Disposable database required.');
$email=$argv[1]??'';
if(!preg_match('/^auth-acceptance-[a-f0-9]+@review\.test$/D',$email))throw new RuntimeException('Not an authentication fixture.');
$q=database()->prepare("UPDATE users SET name='enc:v1:corrupt' WHERE email_lookup=? AND role='user'");$q->execute([emailLookup($email)]);
if($q->rowCount()!==1)throw new RuntimeException('Fixture missing.');
