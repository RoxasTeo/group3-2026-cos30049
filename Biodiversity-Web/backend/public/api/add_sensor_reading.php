<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

// Authenticate ESP32 device
$expectedKey = getenv('IOT_DEVICE_API_KEY');
$providedKey = $_SERVER['HTTP_X_DEVICE_KEY'] ?? '';

if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
    respond(401, [
        'error' => 'Invalid device API key.'
    ]);
}

$data = jsonBody();

$plantId = filter_var(
    $data['plant_id'] ?? null,
    FILTER_VALIDATE_INT
);

if (!$plantId || $plantId <= 0) {
    respond(400, [
        'error' => 'A valid plant_id is required.'
    ]);
}

// Validate required sensor values
if (
    !isset($data['temperature']) ||
    !is_numeric($data['temperature']) ||
    !isset($data['humidity']) ||
    !is_numeric($data['humidity'])
) {
    respond(400, [
        'error' => 'Temperature and humidity are required and must be numeric.'
    ]);
}

$temperature = (float) $data['temperature'];
$humidity = (float) $data['humidity'];

if ($temperature < -50 || $temperature > 100) {
    respond(400, [
        'error' => 'Temperature must be between -50 and 100.'
    ]);
}

if ($humidity < 0 || $humidity > 100) {
    respond(400, [
        'error' => 'Humidity must be between 0 and 100.'
    ]);
}

// Validate optional soil moisture raw value
$soilRaw = $data['soil_moisture_raw'] ?? null;

if ($soilRaw !== null) {
    $soilRaw = filter_var($soilRaw, FILTER_VALIDATE_INT);

    if ($soilRaw === false || $soilRaw < 0 || $soilRaw > 4095) {
        respond(400, [
            'error' => 'Soil moisture raw value must be between 0 and 4095.'
        ]);
    }
}

// Validate optional soil moisture percentage
$soilPercent = $data['soil_moisture_raw_percent'] ?? null;

if ($soilPercent !== null) {
    if (!is_numeric($soilPercent)) {
        respond(400, [
            'error' => 'Soil moisture percentage must be numeric.'
        ]);
    }

    $soilPercent = (float) $soilPercent;

    if ($soilPercent < 0 || $soilPercent > 100) {
        respond(400, [
            'error' => 'Soil moisture percentage must be between 0 and 100.'
        ]);
    }
}

// Optional tracking assignment ID
$assignmentId = $data['tracking_assignment_id'] ?? null;

if ($assignmentId !== null) {
    $assignmentId = filter_var(
        $assignmentId,
        FILTER_VALIDATE_INT
    );

    if ($assignmentId === false || $assignmentId <= 0) {
        respond(400, [
            'error' => 'Invalid tracking_assignment_id.'
        ]);
    }
}

try {
    $pdo = database();

    // Get the registered coordinates from tracked_plants
    $checkPlant = $pdo->prepare(
        "SELECT latitude, longitude
         FROM tracked_plants
         WHERE id = :plant_id"
    );

    $checkPlant->execute([
        ':plant_id' => $plantId
    ]);

    $plant = $checkPlant->fetch(PDO::FETCH_ASSOC);

    if (!$plant) {
        respond(404, [
            'error' => 'Tracked plant not found.'
        ]);
    }

    $latitude = $plant['latitude'];
    $longitude = $plant['longitude'];

    // Verify that the assignment belongs to this plant
    if ($assignmentId !== null) {
        $checkAssignment = $pdo->prepare(
            "SELECT id
             FROM tracking_assignments
             WHERE id = :assignment_id
               AND plant_id = :plant_id
               AND ended_at IS NULL"
        );

        $checkAssignment->execute([
            ':assignment_id' => $assignmentId,
            ':plant_id' => $plantId
        ]);

        if (!$checkAssignment->fetch(PDO::FETCH_ASSOC)) {
            respond(400, [
                'error' => 'Tracking assignment does not belong to this plant or is inactive.'
            ]);
        }
    }

    // Insert sensor reading
    $stmt = $pdo->prepare(
        "INSERT INTO sensor_readings (
            tracking_assignment_id,
            plant_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_raw_percent,
            latitude,
            longitude
        ) VALUES (
            :assignment_id,
            :plant_id,
            :temperature,
            :humidity,
            :soil_raw,
            :soil_percent,
            :latitude,
            :longitude
        )"
    );

    $stmt->execute([
        ':assignment_id' => $assignmentId,
        ':plant_id' => $plantId,
        ':temperature' => $temperature,
        ':humidity' => $humidity,
        ':soil_raw' => $soilRaw,
        ':soil_percent' => $soilPercent,
        ':latitude' => $latitude,
        ':longitude' => $longitude
    ]);

    respond(201, [
        'message' => 'Sensor reading saved successfully.',
        'reading_id' => $pdo->lastInsertId(),
        'plant_id' => $plantId,
        'latitude' => $latitude,
        'longitude' => $longitude
    ]);

} catch (PDOException $e) {
    error_log('Sensor Reading Insert Error: ' . $e->getMessage());

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
