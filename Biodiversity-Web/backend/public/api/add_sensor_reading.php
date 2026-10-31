<?php
require_once __DIR__ . '/../../threat_detection.php';
api(['POST']);

// Authenticate the ESP32 using a device-specific API key.
// Configure this secret on the server and in the ESP32.
$deviceKey = getenv('IOT_DEVICE_API_KEY');
$providedKey = $_SERVER['HTTP_X_DEVICE_KEY'] ?? '';

if (
    !is_string($deviceKey) ||
    $deviceKey === '' ||
    !is_string($providedKey) ||
    !hash_equals($deviceKey, $providedKey)
) {
    respond(401, ['error' => 'Unauthorized device.']);
}

$body = jsonBody();

// Accept either agreed API name during device integration; never accept conflicting IDs.
if (isset($body['plant_id'], $body['species_id']) && filter_var($body['plant_id'], FILTER_VALIDATE_INT) !== filter_var($body['species_id'], FILTER_VALIDATE_INT)) {
    respond(400, ['error' => 'plant_id and species_id must identify the same species.']);
}
if (!isset($body['plant_id']) && isset($body['species_id'])) $body['plant_id'] = $body['species_id'];


$required = [
    'plant_id',
    'temperature',
    'humidity',
    'distance_cm',
    'latitude',
    'longitude'
];

foreach ($required as $field) {
    if (!isset($body[$field]) || !is_numeric($body[$field])) {
        respond(400, ['error' => "Missing or invalid field: $field"]);
    }
}

$plantId = filter_var($body['plant_id'], FILTER_VALIDATE_INT);
$temperature = (float) $body['temperature'];
$humidity = (float) $body['humidity'];
$distance = (float) $body['distance_cm'];
$latitude = (float) $body['latitude'];
$longitude = (float) $body['longitude'];

if (
    $plantId === false || $plantId < 1 ||
    !is_finite($temperature) ||
    !is_finite($humidity) ||
    !is_finite($distance) ||
    !is_finite($latitude) ||
    !is_finite($longitude) ||
    $humidity < 0 || $humidity > 100 ||
    $temperature < -999.99 || $temperature > 999.99 ||
    $distance < 0 || $distance > 999999.99 ||
    $latitude < -90 || $latitude > 90 ||
    $longitude < -180 || $longitude > 180
) {
    respond(400, ['error' => 'Sensor values are outside valid ranges.']);
}

$db = database();

$config = threatConfiguration();
try {
    $db->beginTransaction();
    // Ensure that the referenced species exists.
    $check = $db->prepare(
        'SELECT species_id FROM species WHERE species_id = :plant_id FOR UPDATE'
    );
    $check->execute([':plant_id' => $plantId]);

    if (!$check->fetch()) {
        $db->rollBack();
        respond(404, ['error' => 'Species not found.']);
    }

    $previousQuery = $db->prepare('SELECT distance_cm FROM sensor_readings WHERE plant_id = ? AND tracking_assignment_id IS NULL AND recorded_at >= DATE_SUB(NOW(), INTERVAL ' . (int) $config['baseline_max_age_seconds'] . ' SECOND) ORDER BY reading_id DESC LIMIT 1');
    $previousQuery->execute([$plantId]);
    $previous = $previousQuery->fetch() ?: null;
    $reading = ['temperature' => $temperature, 'humidity' => $humidity, 'distance_cm' => $distance, 'latitude' => $latitude, 'longitude' => $longitude];
    $sql = "INSERT INTO sensor_readings (
                plant_id, temperature, humidity, distance_cm,
                latitude, longitude
            ) VALUES (
                :plant_id, :temperature, :humidity, :distance_cm,
                :latitude, :longitude
            )";

    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':plant_id'   => $plantId,
        ':temperature' => $temperature,
        ':humidity'    => $humidity,
        ':distance_cm' => $distance,
        ':latitude'    => $latitude,
        ':longitude'   => $longitude
    ]);

    $readingId = (int) $db->lastInsertId();
    $alerts = storeAutomaticThreats($db, $plantId, $reading, detectThreats($reading, $previous, $config), $config);
    $db->commit();
    respond(201, [
        'status' => 'success',
        'message' => 'Sensor reading successfully recorded.',
        'reading_id' => $readingId,
        'automatic_alerts' => $alerts
    ]);

} catch (\Throwable $e) {
    if ($db->inTransaction()) $db->rollBack();
    error_log('Sensor Reading Insert Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database storage failure.']);
}
