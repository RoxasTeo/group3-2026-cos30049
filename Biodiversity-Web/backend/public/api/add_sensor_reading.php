<?php
require_once __DIR__ . '/../../bootstrap.php';
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
    $distance < 0 ||
    $latitude < -90 || $latitude > 90 ||
    $longitude < -180 || $longitude > 180
) {
    respond(400, ['error' => 'Sensor values are outside valid ranges.']);
}

$db = database();

try {
    // Ensure that the referenced species exists.
    $check = $db->prepare(
        'SELECT species_id FROM species WHERE species_id = :plant_id'
    );
    $check->execute([':plant_id' => $plantId]);

    if (!$check->fetch()) {
        respond(404, ['error' => 'Species not found.']);
    }

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

    respond(201, [
        'status' => 'success',
        'message' => 'Sensor reading successfully recorded.',
        'reading_id' => $db->lastInsertId()
    ]);

} catch (\PDOException $e) {
    error_log('Sensor Reading Insert Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database storage failure.']);
}
