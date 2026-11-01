<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

// ==========================================
// AUTHENTICATE ESP32 DEVICE
// ==========================================

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

// ==========================================
// READ JSON REQUEST BODY
// ==========================================

$body = jsonBody();

// ==========================================
// VALIDATE REQUIRED FIELDS
// ==========================================

$required = [
    'plant_id',
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

// ==========================================
// VALIDATE PLANT ID
// ==========================================

$plantId = filter_var(
    $body['plant_id'],
    FILTER_VALIDATE_INT
);

if ($plantId === false || $plantId < 1) {
    respond(400, [
        'error' => 'Invalid plant_id.'
    ]);
}

// ==========================================
// VALIDATE TRACKING ASSIGNMENT ID
// ==========================================

$trackingAssignmentId = null;

if (
    array_key_exists('tracking_assignment_id', $body) &&
    $body['tracking_assignment_id'] !== null
) {
    $trackingAssignmentId = filter_var(
        $body['tracking_assignment_id'],
        FILTER_VALIDATE_INT
    );

    if (
        $trackingAssignmentId === false ||
        $trackingAssignmentId < 1
    ) {
        respond(400, [
            'error' => 'Invalid tracking_assignment_id.'
        ]);
    }
}

// ==========================================
// VALIDATE TEMPERATURE AND HUMIDITY
// ==========================================

$temperature = (float) $body['temperature'];
$humidity = (float) $body['humidity'];

if (
    $temperature < -50 ||
    $temperature > 100 ||
    $humidity < 0 ||
    $humidity > 100
) {
    respond(400, [
        'error' => 'Invalid temperature or humidity value.'
    ]);
}

// ==========================================
// VALIDATE SOIL MOISTURE RAW
// ==========================================

$soilMoistureRaw = null;

if (
    array_key_exists('soil_moisture_raw', $body) &&
    $body['soil_moisture_raw'] !== null
) {
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
            'error' => 'Invalid soil_moisture_raw value.'
        ]);
    }
}

// ==========================================
// VALIDATE SOIL MOISTURE PERCENTAGE
// ==========================================

$soilMoisturePercent = null;

if (
    array_key_exists('soil_moisture_percent', $body) &&
    $body['soil_moisture_percent'] !== null
) {
    if (!is_numeric($body['soil_moisture_percent'])) {
        respond(400, [
            'error' => 'Invalid soil_moisture_percent value.'
        ]);
    }

    $soilMoisturePercent = (float) $body['soil_moisture_percent'];

    if (
        $soilMoisturePercent < 0 ||
        $soilMoisturePercent > 100
    ) {
        respond(400, [
            'error' => 'Soil moisture percentage must be between 0 and 100.'
        ]);
    }
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

$db = database();

try {

    // ======================================
    // CHECK WHETHER PLANT EXISTS
    // ======================================

    $checkPlant = $db->prepare(
        'SELECT id
         FROM plants
         WHERE id = :plant_id'
    );

    $checkPlant->execute([
        ':plant_id' => $plantId
    ]);

    if (!$checkPlant->fetch()) {
        respond(404, [
            'error' => 'Plant not found.'
        ]);
    }

    // ======================================
    // CHECK TRACKING ASSIGNMENT
    // ======================================

    if ($trackingAssignmentId !== null) {

        $checkAssignment = $db->prepare(
            'SELECT id
             FROM tracking_assignments
             WHERE id = :assignment_id
               AND plant_id = :plant_id
               AND ended_at IS NULL'
        );

        $checkAssignment->execute([
            ':assignment_id' => $trackingAssignmentId,
            ':plant_id' => $plantId
        ]);

        if (!$checkAssignment->fetch()) {
            respond(400, [
                'error' => 'Invalid or inactive tracking assignment for this plant.'
            ]);
        }
    }

    // ======================================
    // INSERT SENSOR READING
    // ======================================

    $sql = "INSERT INTO sensor_readings (
                tracking_assignment_id,
                plant_id,
                temperature,
                humidity,
                soil_moisture_raw,
                soil_moisture_percent
            ) VALUES (
                :tracking_assignment_id,
                :plant_id,
                :temperature,
                :humidity,
                :soil_moisture_raw,
                :soil_moisture_percent
            )";

    $stmt = $db->prepare($sql);

    $stmt->execute([
        ':tracking_assignment_id' => $trackingAssignmentId,
        ':plant_id' => $plantId,
        ':temperature' => $temperature,
        ':humidity' => $humidity,
        ':soil_moisture_raw' => $soilMoistureRaw,
        ':soil_moisture_percent' => $soilMoisturePercent
    ]);

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    respond(201, [
        'status' => 'success',
        'message' => 'Sensor reading successfully recorded.',
        'reading_id' => (int) $db->lastInsertId(),
        'plant_id' => $plantId,
        'tracking_assignment_id' => $trackingAssignmentId
    ]);

} catch (PDOException $e) {

    error_log(
        'Sensor Reading Insert Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
