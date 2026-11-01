<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

// Authenticate the ESP32 using its device API key.
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

// Read the JSON request.
$body = jsonBody();

// Required fields.
$required = [
    'species_id',
    'temperature',
    'humidity'
];

foreach ($required as $field) {
    if (
        !array_key_exists($field, $body) ||
        !is_numeric($body[$field])
    ) {
        respond(400, [
            'error' => "Missing or invalid field: $field"
        ]);
    }
}

// Validate and convert values.
$speciesId = filter_var(
    $body['species_id'],
    FILTER_VALIDATE_INT
);

$temperature = (float) $body['temperature'];
$humidity = (float) $body['humidity'];

if (
    $speciesId === false ||
    $speciesId < 1 ||
    !is_finite($temperature) ||
    !is_finite($humidity) ||
    $humidity < 0 ||
    $humidity > 100
) {
    respond(400, [
        'error' => 'Sensor values are outside valid ranges.'
    ]);
}

// Optional soil moisture readings.
$soilMoistureRaw = null;
$soilMoisturePercent = null;

// Validate raw ADC value.
if (array_key_exists('soil_moisture_raw', $body)) {
    if (
        $body['soil_moisture_raw'] === null ||
        !is_numeric($body['soil_moisture_raw'])
    ) {
        respond(400, [
            'error' => 'Invalid soil_moisture_raw value.'
        ]);
    }

    $soilMoistureRaw = filter_var(
        $body['soil_moisture_raw'],
        FILTER_VALIDATE_INT
    );

    if (
        $soilMoistureRaw === false ||
        $soilMoistureRaw < 0 ||
        $soilMoistureRaw > 4095
    ) {
        respond(400, [
            'error' => 'Soil moisture raw value must be between 0 and 4095.'
        ]);
    }
}

// Validate calibrated soil moisture percentage.
if (array_key_exists('soil_moisture_percent', $body)) {
    if (
        $body['soil_moisture_percent'] === null ||
        !is_numeric($body['soil_moisture_percent'])
    ) {
        respond(400, [
            'error' => 'Invalid soil_moisture_percent value.'
        ]);
    }

    $soilMoisturePercent =
        (float) $body['soil_moisture_percent'];

    if (
        !is_finite($soilMoisturePercent) ||
        $soilMoisturePercent < 0 ||
        $soilMoisturePercent > 100
    ) {
        respond(400, [
            'error' => 'Soil moisture percentage must be between 0 and 100.'
        ]);
    }
}

$db = database();

try {
    // Retrieve the species names for the response.
    $check = $db->prepare(
        'SELECT species_id, common_name, scientific_name
         FROM species
         WHERE species_id = :species_id'
    );

    $check->execute([
        ':species_id' => $speciesId
    ]);

    $species = $check->fetch();

    if (!$species) {
        respond(404, [
            'error' => 'Species not found.'
        ]);
    }

    // Insert the sensor reading.
    $sql = "INSERT INTO sensor_readings (
                species_id,
                temperature,
                humidity,
                soil_moisture_raw,
                soil_moisture_percent
            ) VALUES (
                :species_id,
                :temperature,
                :humidity,
                :soil_moisture_raw,
                :soil_moisture_percent
            )";

    $stmt = $db->prepare($sql);

    $stmt->execute([
        ':species_id' => $speciesId,
        ':temperature' => $temperature,
        ':humidity' => $humidity,
        ':soil_moisture_raw' => $soilMoistureRaw,
        ':soil_moisture_percent' => $soilMoisturePercent
    ]);

    respond(201, [
        'status' => 'success',
        'message' => 'Sensor reading successfully recorded.',
        'reading_id' => (int) $db->lastInsertId(),
        'common_name' => $species['common_name'],
        'scientific_name' => $species['scientific_name']
    ]);

} catch (PDOException $e) {
    error_log(
        'Sensor Reading Insert Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
