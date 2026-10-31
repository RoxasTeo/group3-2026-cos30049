<?php
require_once __DIR__ . '/../../observations.php';
api(['POST']);
$user = requireRole(['botanist']);
requireCsrf();
$body = jsonBody(29 * 1024 * 1024);
$reference = observationText($body, 'client_reference', 64, true);
$tag = observationText($body, 'plant_tag', 64, true);
if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/D', $tag) || !preg_match('/^[A-Za-z0-9_-]{3,64}$/D', $reference)) respond(400, ['error' => 'Invalid plant tag or client reference.']);
$latitude = observationNumber($body, 'latitude', -90, 90);
$longitude = observationNumber($body, 'longitude', -180, 180);
$accuracy = observationNumber($body, 'accuracy_m', 0, 99999999);
if (($latitude === null) !== ($longitude === null) || ($latitude === null && $accuracy !== null)) respond(400, ['error' => 'Provide both GPS coordinates, or neither.']);
$height = observationNumber($body, 'height_m', 0, 999999);
$capturedAt = observationText($body, 'location_captured_at', 40);
if ($capturedAt !== '') {
    if ($latitude === null || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/D', $capturedAt)) respond(400, ['error' => 'Invalid location timestamp; use ISO 8601 with timezone.']);
    try { $capturedAt = (new DateTimeImmutable($capturedAt))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'); }
    catch (Exception $e) { respond(400, ['error' => 'Invalid location timestamp.']); }
}
$photos = observationPhotos($body['photos'] ?? []);
$speciesId = isset($body['species_id']) ? observationId($body['species_id']) : null;
$values = [
    (int) $user['id'], $reference, strtoupper($tag), $speciesId,
    observationText($body, 'common_name', 120) ?: 'Unidentified plant',
    observationText($body, 'scientific_name', 160), observationText($body, 'family', 100),
    observationText($body, 'field_notes', 5000, true), observationText($body, 'habitat', 2000),
    $height, $latitude, $longitude, $accuracy, $capturedAt ?: null,
    json_encode($photos, JSON_THROW_ON_ERROR), count($photos),
];
$db = database();
if ($speciesId !== null) {
    $stmt = $db->prepare('SELECT species_id FROM species WHERE species_id = ?');
    $stmt->execute([$speciesId]);
    if (!$stmt->fetch()) respond(400, ['error' => 'Linked species does not exist.']);
}
try {
    $stmt = $db->prepare('INSERT INTO observations (submitted_by, client_reference, plant_tag, species_id, common_name, scientific_name, family, field_notes, habitat, height_m, latitude, longitude, accuracy_m, location_captured_at, photos, photo_count, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
    $stmt->execute($values);
} catch (PDOException $e) {
    if (($e->errorInfo[1] ?? null) === 1062) respond(409, ['error' => 'This client reference was already submitted.']);
    throw $e;
}
respond(201, ['observation' => observationDetail($db, (int) $db->lastInsertId())]);
