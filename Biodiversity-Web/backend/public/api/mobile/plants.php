<?php
require_once __DIR__ . '/../../../mobile.php';
api(['GET', 'POST'], false);
$db = database();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Each account downloads its own field records; officers review everyone's on the Web portal.
    $user = requireMobileUser();
    $limit = filter_var($_GET['limit'] ?? 100, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 100]]);
    $offset = filter_var($_GET['offset'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
    if ($limit === false || $offset === false) respond(400, ['error' => 'Invalid paging.']);
    $stmt = $db->prepare('SELECT ' . MOBILE_RECORD_COLUMNS . " FROM observations o WHERE o.submitted_by = ? ORDER BY o.id LIMIT $limit OFFSET $offset");
    $stmt->execute([$user['id']]);
    respond(200, ['records' => array_map('mobilePlantRecord', $stmt->fetchAll())]);
}

$user = requireMobileUser(['botanist']);
// Up to four 5 MB photographs, base64 encoded, plus text fields.
$body = jsonBody(29 * 1024 * 1024);
$tag = strtoupper(observationText($body, 'plantId', 64, true));
if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{2,63}$/D', $tag)) respond(400, ['error' => 'Invalid plant ID.']);

// The plant ID is the client reference, so a retried upload returns the stored record instead of a duplicate.
$existing = mobileRecordByTag($db, $user['id'], $tag);
if ($existing) respond(200, ['record' => $existing]);

$height = trim((string) ($body['heightMetres'] ?? ''));
if ($height !== '' && (!is_numeric($height) || (float) $height < 0 || (float) $height > 150)) respond(400, ['error' => 'Height must be between 0 and 150 metres.']);

$location = $body['location'] ?? null;
if ($location !== null && !$location instanceof stdClass) respond(400, ['error' => 'Invalid location.']);
$location = $location ? (array) $location : [];
$latitude = observationNumber($location, 'latitude', -90, 90);
$longitude = observationNumber($location, 'longitude', -180, 180);
$accuracy = observationNumber($location, 'accuracy', 0, 99999999);
if (($latitude === null) !== ($longitude === null)) respond(400, ['error' => 'Provide both GPS coordinates, or neither.']);
$capturedAt = observationText($location, 'capturedAt', 40);
if ($capturedAt !== '') {
    try { $capturedAt = (new DateTimeImmutable($capturedAt))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'); }
    catch (Exception $e) { respond(400, ['error' => 'Invalid location timestamp.']); }
}

// The app sends {id, caption, data}; store them in the shape the Web review screen already reads.
$photos = $body['photos'] ?? [];
if (!is_array($photos) || !array_is_list($photos)) respond(400, ['error' => 'Invalid photographs.']);
$photos = observationPhotos(array_map(function (mixed $photo): mixed {
    if (!$photo instanceof stdClass) return $photo;
    return (object) ['data_url' => $photo->data ?? null, 'caption' => $photo->caption ?? '', 'file_name' => $photo->id ?? ''];
}, $photos));

$scientific = observationText($body, 'scientificName', 160);
// Link to the knowledge-system species by scientific name so the record appears on distribution maps.
$speciesId = null;
if ($scientific !== '') {
    $stmt = $db->prepare('SELECT species_id FROM species WHERE scientific_name = ? ORDER BY species_id LIMIT 1');
    $stmt->execute([$scientific]);
    $speciesId = $stmt->fetchColumn() ?: null;
}

try {
    $stmt = $db->prepare('INSERT INTO observations (submitted_by, client_reference, plant_tag, species_id, common_name, scientific_name, family, field_notes, habitat, morphology, conservation_status, height_m, latitude, longitude, accuracy_m, location_captured_at, photos, photo_count, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
    $stmt->execute([
        $user['id'], $tag, $tag, $speciesId,
        observationText($body, 'commonName', 120) ?: 'Unidentified plant', $scientific, observationText($body, 'family', 100),
        observationText($body, 'description', 5000, true), observationText($body, 'habitatNotes', 2000),
        observationText($body, 'morphology', 5000), observationText($body, 'conservationStatus', 40),
        $height === '' ? null : (float) $height, $latitude, $longitude, $latitude === null ? null : $accuracy, $capturedAt ?: null,
        json_encode($photos, JSON_THROW_ON_ERROR), count($photos),
    ]);
} catch (PDOException $e) {
    // A concurrent retry of the same upload won the insert; return that record.
    if (($e->errorInfo[1] ?? null) === 1062 && ($existing = mobileRecordByTag($db, $user['id'], $tag))) respond(200, ['record' => $existing]);
    throw $e;
}
respond(201, ['record' => mobileRecordByTag($db, $user['id'], $tag)]);
