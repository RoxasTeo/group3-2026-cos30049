<?php
require_once __DIR__ . '/../bootstrap.php';
if(PHP_SAPI!=='cli'||setting('DB_HOST')!=='127.0.0.1'||!str_ends_with(setting('DB_NAME'),'_test'))throw new RuntimeException('Local test database required.');
$db=database();$identity=$db->query('SELECT CURRENT_USER()')->fetchColumn();
if(str_starts_with($identity,'root@'))throw new RuntimeException('Runtime must not use root.');
$grants=$db->query('SHOW GRANTS FOR CURRENT_USER()')->fetchAll(PDO::FETCH_COLUMN);
foreach($grants as $grant)if(preg_match('/\b(ALL PRIVILEGES|CREATE|ALTER|DROP|TRIGGER|SUPER|GRANT OPTION|FILE|PROCESS)\b/',$grant))throw new RuntimeException('Runtime has excessive privileges.');
if(!array_filter($grants,fn($g)=>str_contains($g,'SELECT')&&str_contains($g,'INSERT')&&str_contains($g,'UPDATE')&&str_contains($g,'DELETE')))throw new RuntimeException('Runtime data permissions are missing.');
echo "PASS: local runtime uses a dedicated non-root account with data read/write only; no schema, trigger, file or administration grants.\n";
