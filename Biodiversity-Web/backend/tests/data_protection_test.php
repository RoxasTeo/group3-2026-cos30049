<?php
require_once __DIR__ . '/../bootstrap.php';
function expectRejected(callable $operation): void {
    try { $operation(); } catch (RuntimeException $error) { return; }
    throw new RuntimeException('Unsafe operation was accepted.');
}
function verify(bool $condition): void { if (!$condition) throw new RuntimeException('Data protection assertion failed.'); }
$keyPath=setting('DATA_ENCRYPTION_KEY_FILE');
$one=protectData('Sensitive name / 中文','users.name:100');
$two=protectData('Sensitive name / 中文','users.name:100');
verify($one!==$two);
verify(revealData($one,'users.name:100')==='Sensitive name / 中文');
verify(revealData(protectData('','reviews.notes:1:1:1'),'reviews.notes:1:1:1')==='');
expectRejected(fn()=>revealData($one,'users.name:101'));
expectRejected(fn()=>revealData($one,'users.email:100'));
$bytes=base64_decode(substr($one,7));$bytes[15]=chr(ord($bytes[15])^1);
expectRejected(fn()=>revealData('enc:v1:'.base64_encode($bytes),'users.name:100'));
expectRejected(fn()=>revealData('enc:v1:abc','users.name:100'));
expectRejected(fn()=>revealData('plain name','users.name:100'));
verify(emailLookup(' User@Example.test ')===emailLookup('user@example.test'));
verify(emailLookup('user@example.test')!==hash('sha256','user@example.test'));
$temporary=tempnam(dirname(privateDataPath($keyPath)),'crypto-test-');
try {
    file_put_contents($temporary,base64_encode(random_bytes(32)));chmod($temporary,0600);
    putenv('DATA_ENCRYPTION_KEY_FILE='.$temporary);
    expectRejected(fn()=>revealData($one,'users.name:100'));
    putenv('DATA_ENCRYPTION_KEY_FILE='.$temporary.'-missing');
    expectRejected(fn()=>protectData('test','test'));
    putenv('DATA_ENCRYPTION_KEY_FILE='.__DIR__.'/../.env');
    expectRejected(fn()=>protectData('test','test'));
} finally { putenv('DATA_ENCRYPTION_KEY_FILE='.$keyPath);unlink($temporary); }
echo "PASS: authenticated encryption, random IVs, Unicode/empty fields, row/field binding, tamper/truncation rejection, keyed lookup, wrong/missing key and repository-key rejection.\n";
