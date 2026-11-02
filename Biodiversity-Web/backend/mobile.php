<?php
declare(strict_types=1);
require_once __DIR__ . '/observations.php';

// Mobile app API: bearer tokens instead of cookies. Field records are stored as normal
// observations, so Web review, distribution maps and reports see them immediately.
const MOBILE_ROLES = ['botanist', 'conservation_officer'];

function issueMobileToken(PDO $db, int $userId): array {
    $token = bin2hex(random_bytes(32));
    $ttl = max(300, min(86400, (int) setting('MOBILE_TOKEN_SECONDS', '43200')));
    $db->prepare('DELETE FROM mobile_tokens WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP()')->execute([$userId]);
    // Only the hash is stored, so a database leak does not expose usable tokens.
    $db->prepare('INSERT INTO mobile_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))')
        ->execute([hash('sha256', $token), $userId, $ttl]);
    return ['token' => $token, 'expiresIn' => $ttl];
}

function bearerTokenHash(): ?string {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) if (strcasecmp($name, 'Authorization') === 0) $header = $value;
    }
    return preg_match('/^Bearer ([a-f0-9]{64})$/D', (string) $header, $match) ? hash('sha256', $match[1]) : null;
}

function requireMobileUser(array $roles = MOBILE_ROLES): array {
    $hash = bearerTokenHash();
    if ($hash === null) respond(401, ['error' => 'Authentication required']);
    assertDatabaseKey(database());
    $stmt = database()->prepare('SELECT u.id, u.name, u.email, u.role, u.is_active FROM mobile_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.expires_at > UTC_TIMESTAMP()');
    $stmt->execute([$hash]);
    $user = $stmt->fetch();
    // Deactivated accounts lose mobile access immediately, like Web sessions.
    if (!$user || !$user['is_active']) respond(401, ['error' => 'Session expired']);
    if (!in_array($user['role'], $roles, true)) respond(403, ['error' => 'Insufficient permissions']);
    $user = revealUser($user);
    unset($user['is_active']);
    $user['id'] = (int) $user['id'];
    return $user;
}

function utcIso(?string $value): ?string {
    return $value === null ? null : (new DateTimeImmutable($value, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}

function formatHeight(mixed $value): string {
    if ($value === null) return '';
    return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');
}

// Columns needed by mobilePlantRecord(). Photo bytes stay on the server; the app downloads them separately.
const MOBILE_RECORD_COLUMNS = "o.id, o.submitted_by, o.client_reference, o.plant_tag, o.common_name, o.scientific_name, o.family, o.field_notes, o.habitat, o.morphology,
    o.conservation_status, o.height_m, o.latitude, o.longitude, o.accuracy_m, o.location_captured_at, o.status, o.submitted_at, o.reviewed_at,
    JSON_EXTRACT(o.photos, '$[*].file_name') AS photo_ids, JSON_EXTRACT(o.photos, '$[*].caption') AS photo_captions,
    (SELECT JSON_OBJECT('notes', r.notes, 'observation_id', r.observation_id, 'observation_version', r.observation_version, 'reviewer_id', r.reviewer_id)
        FROM observation_reviews r WHERE r.observation_id = o.id ORDER BY r.id DESC LIMIT 1) AS latest_review";

function mobilePlantRecord(array $row): array {
    $ids = $row['photo_ids'] === null ? [] : json_decode($row['photo_ids'], true, 4, JSON_THROW_ON_ERROR);
    $captions = $row['photo_captions'] === null ? [] : json_decode($row['photo_captions'], true, 4, JSON_THROW_ON_ERROR);
    $photos = [];
    foreach ($ids as $index => $id) {
        $photos[] = ['id' => is_string($id) && $id !== '' ? $id : 'photo-' . ($index + 1), 'caption' => (string) ($captions[$index] ?? ''), 'remoteIndex' => $index];
    }
    $review = $row['latest_review'] === null ? null : json_decode($row['latest_review'], true, 4, JSON_THROW_ON_ERROR);
    $location = null;
    if ($row['latitude'] !== null && $row['longitude'] !== null) {
        $location = ['latitude' => (float) $row['latitude'], 'longitude' => (float) $row['longitude']];
        if ($row['accuracy_m'] !== null) $location['accuracy'] = (float) $row['accuracy_m'];
        if ($row['location_captured_at'] !== null) $location['capturedAt'] = utcIso($row['location_captured_at']);
    }
    return [
        'plantId' => $row['plant_tag'],
        'commonName' => $row['common_name'],
        'scientificName' => $row['scientific_name'],
        'family' => $row['family'],
        'heightMetres' => formatHeight($row['height_m']),
        'morphology' => (string) ($row['morphology'] ?? ''),
        'conservationStatus' => $row['conservation_status'],
        'description' => revealData($row['field_notes'], observationSecretContext($row, 'field_notes')),
        'habitatNotes' => revealData($row['habitat'], observationSecretContext($row, 'habitat')),
        'status' => 'Synced',
        'reviewStatus' => $row['status'],
        // Reviewer feedback matters to the botanist only while the record is not approved.
        'reviewNotes' => $row['status'] === 'Approved' || !$review ? '' : revealData($review['notes'], reviewNotesContext($review)),
        'reference' => 'OBS-' . str_pad((string) $row['id'], 6, '0', STR_PAD_LEFT),
        'createdAt' => utcIso($row['submitted_at']),
        'updatedAt' => utcIso($row['reviewed_at'] ?? $row['submitted_at']),
        'photos' => $photos,
        'location' => $location,
        'sample' => false,
    ];
}

function mobileRecordByTag(PDO $db, int $userId, string $plantTag): ?array {
    $stmt = $db->prepare('SELECT ' . MOBILE_RECORD_COLUMNS . ' FROM observations o WHERE o.submitted_by = ? AND o.client_reference = ?');
    $stmt->execute([$userId, $plantTag]);
    $row = $stmt->fetch();
    return $row ? mobilePlantRecord($row) : null;
}
