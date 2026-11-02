<?php
declare(strict_types=1);

function privateDataPath(string $path, bool $directory = false): string {
    $resolved = realpath($path);
    if ($resolved === false || ($directory ? !is_dir($resolved) : !is_file($resolved))) {
        throw new RuntimeException('Private encryption file or directory is unavailable.');
    }
    $normal = strtolower(str_replace('\\', '/', $resolved));
    $repository = strtolower(str_replace('\\', '/', (string) realpath(dirname(__DIR__, 2))));
    if ($normal === $repository || str_starts_with($normal, $repository . '/')) {
        throw new RuntimeException('Encryption material must be outside the repository and public directory.');
    }
    for ($cursor = $directory ? $resolved : dirname($resolved); ; $cursor = dirname($cursor)) {
        if (file_exists($cursor . DIRECTORY_SEPARATOR . '.git')) throw new RuntimeException('Encryption material cannot be inside a Git worktree.');
        if (dirname($cursor) === $cursor) break;
    }
    if (!$directory && PHP_OS_FAMILY !== 'Windows' && (fileperms($resolved) & 0077) !== 0) throw new RuntimeException('Private key and backup files require owner-only permissions.');
    return $resolved;
}

function sensitiveKeys(): array {
    $path = privateDataPath(setting('DATA_ENCRYPTION_KEY_FILE'));
    static $cache = [];
    if (isset($cache[$path])) return $cache[$path];
    $encoded = file_get_contents($path, false, null, 0, 128);
    $master = $encoded === false ? false : base64_decode(trim($encoded), true);
    if ($master === false || strlen($master) !== 32) throw new RuntimeException('A valid 256-bit data encryption key is required.');
    return $cache[$path] = [
        'encryption' => hash_hkdf('sha256', $master, 32, 'niah-field-encryption-v1'),
        'lookup' => hash_hkdf('sha256', $master, 32, 'niah-email-lookup-v1'),
    ];
}

function protectData(string $plain, string $context): string {
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', sensitiveKeys()['encryption'], OPENSSL_RAW_DATA, $iv, $tag, 'niah:v1|' . $context, 16);
    if ($cipher === false || strlen($tag) !== 16) throw new RuntimeException('Data encryption failed.');
    return 'enc:v1:' . base64_encode($iv . $tag . $cipher);
}

function revealData(string $stored, string $context): string {
    if (!str_starts_with($stored, 'enc:v1:')) throw new RuntimeException('Sensitive data is not encrypted; run the operator migration.');
    $bytes = base64_decode(substr($stored, 7), true);
    if ($bytes === false || strlen($bytes) < 28) throw new RuntimeException('Invalid encrypted data.');
    $plain = openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', sensitiveKeys()['encryption'], OPENSSL_RAW_DATA, substr($bytes, 0, 12), substr($bytes, 12, 16), 'niah:v1|' . $context);
    if ($plain === false) throw new RuntimeException('Sensitive data authentication failed.');
    return $plain;
}

function emailLookup(string $email): string {
    return hash_hmac('sha256', strtolower(trim($email)), sensitiveKeys()['lookup']);
}

function assertDatabaseKey(PDO $db, bool $initializeEmpty = false): void {
    $row = $db->query('SELECT key_check FROM data_protection_state WHERE id=1')->fetch();
    if (!$row && $initializeEmpty && PHP_SAPI === 'cli' && (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0) {
        $stmt = $db->prepare('INSERT IGNORE INTO data_protection_state (id,key_check) VALUES (1,?)');
        $stmt->execute([protectData('niah-sensitive-data-v1', 'database-key-check')]);
        $row = $db->query('SELECT key_check FROM data_protection_state WHERE id=1')->fetch();
    }
    if (!$row || revealData($row['key_check'], 'database-key-check') !== 'niah-sensitive-data-v1') {
        throw new RuntimeException('Database encryption key does not match or protection is not initialized.');
    }
}

function revealUser(array $user): array {
    $user['name'] = revealData($user['name'], 'users.name:' . $user['id']);
    $user['email'] = revealData($user['email'], 'users.email:' . $user['id']);
    unset($user['email_lookup'], $user['password_hash']);
    return $user;
}

function createProtectedUser(PDO $db, string $name, string $email, string $hash, string $role): int {
    assertDatabaseKey($db, true);
    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) $db->beginTransaction();
    try {
        $stmt = $db->prepare('INSERT INTO users (name,email,email_lookup,password_hash,role,is_active) VALUES (?,?,?,?,?,1)');
        // No plaintext enters SQL, including the short-lived inserted row.
        $stmt->execute(['', '', emailLookup($email), $hash, $role]);
        $id = (int) $db->lastInsertId();
        $stmt = $db->prepare('UPDATE users SET name=?,email=? WHERE id=?');
        $stmt->execute([protectData(trim($name), 'users.name:' . $id), protectData(strtolower(trim($email)), 'users.email:' . $id), $id]);
        if ($ownTransaction) $db->commit();
        return $id;
    } catch (Throwable $error) {
        if ($ownTransaction && $db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function observationSecretContext(array $row, string $field): string {
    return 'observations.' . $field . ':' . $row['submitted_by'] . ':' . $row['client_reference'];
}
