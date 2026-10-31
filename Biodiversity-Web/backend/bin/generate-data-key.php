<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || count($argv) !== 2) { fwrite(STDERR, "Usage: php generate-data-key.php <private-file-outside-repository>\n"); exit(1); }
$parent = privateDataPath(dirname($argv[1]), true);
$path = $parent . DIRECTORY_SEPARATOR . basename($argv[1]);
$handle = fopen($path, 'xb');
if (!$handle) throw new RuntimeException('Key file already exists or cannot be created. Never overwrite an active key.');
chmod($path, 0600);
$bytes = base64_encode(random_bytes(32)) . PHP_EOL;
if (fwrite($handle, $bytes) !== strlen($bytes)) { fclose($handle); throw new RuntimeException('Key creation failed.'); }
fclose($handle);
echo "Encryption key created. Its content is intentionally not displayed. Restrict filesystem permissions and keep a separate secure backup.\n";
