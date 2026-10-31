<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

$deviceKey = getenv('IOT_DEVICE_API_KEY');
$providedKey = $_SERVER['HTTP_X_DEVICE_KEY'] ?? '';

if (
    !is_string($deviceKey) ||
    $deviceKey === '' ||
    !is_string($providedKey) ||
    !hash_equals($deviceKey, $providedKey)
) {
    respond(401, [
        'error' => 'Unauthorized device.'
    ]);
}

$body = jsonBody();

// Accept either agreed API name during device integration; never accept conflicting IDs.
if (isset($body['species_id'], $body['plant_id']) && filter_var($body['species_id'], FILTER_VALIDATE_INT) !== filter_var($body['plant_id'], FILTER_VALIDATE_INT)) {
    respond(400, ['error' => 'plant_id and species_id must identify the same species.']);
}
if (!isset($body['species_id']) && isset($body['plant_id'])) $body['species_id'] = $body['plant_id'];


$required = [
    'species_id',
    'alert_type',
    'severity',
    'message',
    'latitude',
    'longitude'
];

foreach ($required as $field) {
    if (!isset($body[$field])) {
        respond(400, [
            'error' => "Missing field: $field"
        ]);
    }
}

$speciesId = filter_var(
    $body['species_id'],
    FILTER_VALIDATE_INT
);

$type = $body['alert_type'];
$severity = $body['severity'];
$message = $body['message'];

$allowedTypes = [
    'motion',
    'proximity',
    'temperature',
    'humidity'
];

$allowedSeverities = [
    'info',
    'warning',
    'critical'
];

if (
    $speciesId === false ||
    $speciesId < 1 ||
    !is_string($type) ||
    !in_array($type, $allowedTypes, true) ||
    !is_string($severity) ||
    !in_array($severity, $allowedSeverities, true) ||
    !is_string($message) ||
    trim($message) === '' ||
    strlen($message) > 255 ||
    !is_numeric($body['latitude']) ||
    !is_numeric($body['longitude'])
) {
    respond(400, [
        'error' => 'Invalid threat alert data.'
    ]);
}

$latitude = (float) $body['latitude'];
$longitude = (float) $body['longitude'];

if (
    !is_finite($latitude) ||
    !is_finite($longitude) ||
    $latitude < -90 ||
    $latitude > 90 ||
    $longitude < -180 ||
    $longitude > 180
) {
    respond(400, [
        'error' => 'Invalid coordinates.'
    ]);
}

$db = database();

try {
    // Verify that the species exists.
    $check = $db->prepare(
        'SELECT species_id
         FROM species
         WHERE species_id = :species_id'
    );

    $check->execute([
        ':species_id' => $speciesId
    ]);

    if (!$check->fetch()) {
        respond(404, [
            'error' => 'Species not found.'
        ]);
    }

    // Insert the alert.
    // The request uses species_id, while the database column is plant_id.
    $sql = "INSERT INTO threat_alerts (
                plant_id,
                alert_type,
                severity,
                message,
                latitude,
                longitude
            ) VALUES (
                :plant_id,
                :alert_type,
                :severity,
                :message,
                :latitude,
                :longitude
            )";

    $stmt = $db->prepare($sql);

    $stmt->execute([
        ':plant_id'   => $speciesId,
        ':alert_type' => $type,
        ':severity'   => $severity,
        ':message'    => trim($message),
        ':latitude'   => $latitude,
        ':longitude'  => $longitude
    ]);

    respond(201, [
        'status' => 'success',
        'message' => 'Threat alert successfully recorded.',
        'alert_id' => $db->lastInsertId()
    ]);

} catch (\PDOException $e) {
    error_log(
        'Threat Alert Insert Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
