<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

const OBSERVATION_STATUSES = ['Pending', 'Changes requested', 'Approved', 'Rejected'];

function observationId(mixed $value): int {
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) respond(400, ['error' => 'A positive observation ID is required.']);
    return $id;
}

function observationText(array $body, string $key, int $max, bool $required = false): string {
    $value = $body[$key] ?? '';
    if (!is_string($value)) respond(400, ['error' => "Invalid $key."]);
    $value = trim($value);
    if (preg_match_all('/./us', $value) > $max || ($required && $value === '')) respond(400, ['error' => "Missing or oversized $key."]);
    return $value;
}

function observationNumber(array $body, string $key, float $min, float $max): ?float {
    $value = $body[$key] ?? null;
    if ($value === null) return null;
    if ((!is_int($value) && !is_float($value)) || !is_finite((float) $value) || $value < $min || $value > $max) {
        respond(400, ['error' => "Invalid $key."]);
    }
    return (float) $value;
}

function observationPhotos(mixed $photos): array {
    if (!is_array($photos) || !array_is_list($photos) || count($photos) > 4) respond(400, ['error' => 'Attach up to four photographs.']);
    $clean = [];
    foreach ($photos as $photo) {
        if (!$photo instanceof stdClass) respond(400, ['error' => 'Invalid photograph.']);
        $photo = (array) $photo;
        $uri = $photo['data_url'] ?? null;
        if (!is_string($uri) || strlen($uri) > 7 * 1024 * 1024 ||
            !preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$~D', $uri, $match)) {
            respond(400, ['error' => 'Photos must be base64 JPG, PNG or WebP images, up to 5 MB each.']);
        }
        $bytes = base64_decode($match[2], true);
        $info = $bytes === false ? false : @getimagesizefromstring($bytes);
        if ($bytes === false || strlen($bytes) > 5 * 1024 * 1024 || !$info || ($info['mime'] ?? '') !== 'image/' . $match[1]) {
            respond(400, ['error' => 'Invalid or oversized photograph content.']);
        }
        $clean[] = ['data_url' => $uri, 'caption' => observationText($photo, 'caption', 120), 'file_name' => observationText($photo, 'file_name', 255)];
    }
    return $clean;
}

function observationSummary(array $row): array {
    if (isset($row['submitter_name'])) $row['submitter_name'] = revealData($row['submitter_name'], 'users.name:' . $row['submitted_by']);
    foreach (['id', 'submitted_by', 'photo_count', 'version'] as $key) $row[$key] = (int) $row[$key];
    $row['species_id'] = $row['species_id'] === null ? null : (int) $row['species_id'];
    $row['reference'] = 'OBS-' . str_pad((string) $row['id'], 6, '0', STR_PAD_LEFT);
    foreach (['latitude', 'longitude', 'accuracy_m', 'height_m'] as $key) {
        if (array_key_exists($key, $row)) $row[$key] = $row[$key] === null ? null : (float) $row[$key];
    }
    return $row;
}

function observationDetail(PDO $db, int $id): ?array {
    $stmt = $db->prepare('SELECT o.*, u.name AS submitter_name FROM observations o JOIN users u ON u.id = o.submitted_by WHERE o.id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) return null;
    $row = observationSummary($row);
    foreach (['field_notes', 'habitat'] as $field) $row[$field] = revealData($row[$field], observationSecretContext($row, $field));
    $row['photos'] = json_decode($row['photos'], true, 32, JSON_THROW_ON_ERROR);
    $stmt = $db->prepare('SELECT r.id, r.reviewer_id, r.observation_id, r.decision, r.notes, r.checks, r.observation_version, r.created_at, u.name AS reviewer_name FROM observation_reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.observation_id = ? ORDER BY r.id');
    $stmt->execute([$id]);
    $row['reviews'] = array_map(function (array $review): array {
        $review['reviewer_name'] = revealData($review['reviewer_name'], 'users.name:' . $review['reviewer_id']);
        $review['notes'] = revealData($review['notes'], reviewNotesContext($review));
        unset($review['reviewer_id'], $review['observation_id']);
        $review['checks'] = json_decode($review['checks'], true, 32, JSON_THROW_ON_ERROR);
        return $review;
    }, $stmt->fetchAll());
    return $row;
}

function reviewNotesContext(array $review): string {
    return 'reviews.notes:' . $review['observation_id'] . ':' . $review['observation_version'] . ':' . $review['reviewer_id'];
}
