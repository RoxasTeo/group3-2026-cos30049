<?php
require_once __DIR__ . '/../../threat_detection.php';

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

// Validate device code
$deviceCode = trim($data['device_code'] ?? '');

if ($deviceCode === '' || strlen($deviceCode) > 64) {
    respond(400, [
        'error' => 'A valid device_code is required.'
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

// Optional ultrasonic distance (cm)
$distance = $data['distance_cm'] ?? null;

if ($distance !== null) {
    if (
        !is_numeric($distance) ||
        (float) $distance < 0 ||
        (float) $distance > 999999.99
    ) {
        respond(400, [
            'error' => 'distance_cm must be between 0 and 999999.99.'
        ]);
    }

    $distance = (float) $distance;
}

// Optional GPS coordinates from the device
$deviceLatitude = $data['latitude'] ?? null;
$deviceLongitude = $data['longitude'] ?? null;

if (($deviceLatitude === null) !== ($deviceLongitude === null)) {
    respond(400, [
        'error' => 'Provide both latitude and longitude, or neither.'
    ]);
}

if (
    $deviceLatitude !== null &&
    (
        !is_numeric($deviceLatitude) ||
        abs((float) $deviceLatitude) > 90 ||
        !is_numeric($deviceLongitude) ||
        abs((float) $deviceLongitude) > 180
    )
) {
    respond(400, [
        'error' => 'Invalid device GPS coordinates.'
    ]);
}

try {
    $pdo = database();

    // Find the registered and active tracking device
    $deviceStmt = $pdo->prepare(
        "SELECT id
         FROM tracking_devices
         WHERE device_code = :device_code
           AND is_active = 1
         LIMIT 1"
    );

    $deviceStmt->execute([
        ':device_code' => $deviceCode
    ]);

    $device = $deviceStmt->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        respond(404, [
            'error' => 'Tracking device not found or inactive.'
        ]);
    }

    $deviceId = (int) $device['id'];

    // Find the active assignment and associated plant
    $assignmentStmt = $pdo->prepare(
        "SELECT
            ta.id AS tracking_assignment_id,
            ta.plant_id,
            tp.latitude,
            tp.longitude
         FROM tracking_assignments ta
         INNER JOIN tracked_plants tp
             ON tp.id = ta.plant_id
         WHERE ta.device_id = :device_id
           AND ta.ended_at IS NULL
         LIMIT 2"
    );

    $assignmentStmt->execute([
        ':device_id' => $deviceId
    ]);

    $assignments = $assignmentStmt->fetchAll(PDO::FETCH_ASSOC);

    if (count($assignments) === 0) {
        respond(400, [
            'error' => 'This device has no active tracking assignment.'
        ]);
    }

    if (count($assignments) > 1) {
        respond(409, [
            'error' => 'This device has multiple active tracking assignments.'
        ]);
    }

    $assignment = $assignments[0];

    $assignmentId = (int) $assignment['tracking_assignment_id'];
    $plantId = (int) $assignment['plant_id'];

    // Determine the location source
    $locationSource = $deviceLatitude === null ? 'registered' : 'device';

    $latitude = $deviceLatitude === null
        ? $assignment['latitude']
        : (float) $deviceLatitude;

    $longitude = $deviceLongitude === null
        ? $assignment['longitude']
        : (float) $deviceLongitude;

    $config = threatConfiguration();

    $pdo->beginTransaction();

    // Get the most recent distance for this plant and assignment
    $previousStmt = $pdo->prepare(
        "SELECT distance_cm
         FROM sensor_readings
         WHERE plant_id = :plant_id
           AND tracking_assignment_id = :assignment_id
           AND distance_cm IS NOT NULL
           AND recorded_at >= DATE_SUB(
               NOW(),
               INTERVAL " . (int) $config['baseline_max_age_seconds'] . " SECOND
           )
         ORDER BY reading_id DESC
         LIMIT 1
         FOR UPDATE"
    );

    $previousStmt->execute([
        ':plant_id' => $plantId,
        ':assignment_id' => $assignmentId
    ]);

    $previous = $previousStmt->fetch(PDO::FETCH_ASSOC) ?: null;

    // Insert sensor reading
    $stmt = $pdo->prepare(
        "INSERT INTO sensor_readings (
            tracking_assignment_id,
            plant_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_raw_percent,
            distance_cm,
            location_source,
            latitude,
            longitude
        ) VALUES (
            :assignment_id,
            :plant_id,
            :temperature,
            :humidity,
            :soil_raw,
            :soil_percent,
            :distance,
            :location_source,
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
        ':distance' => $distance,
        ':location_source' => $locationSource,
        ':latitude' => $latitude,
        ':longitude' => $longitude
    ]);

    $readingId = (int) $pdo->lastInsertId();

    // Server-side threat detection
    $reading = [
        'temperature' => $temperature,
        'humidity' => $humidity,
        'distance_cm' => $distance,
        'latitude' => $latitude,
        'longitude' => $longitude
    ];

    $alerts = storeAutomaticThreats(
        $pdo,
        $plantId,
        $reading,
        detectThreats($reading, $previous, $config),
        $config,
        $assignmentId
    );

    $pdo->commit();

    respond(201, [
        'message' => 'Sensor reading saved successfully.',
        'reading_id' => $readingId,
        'device_code' => $deviceCode,
        'tracking_assignment_id' => $assignmentId,
        'plant_id' => $plantId,
        'location_source' => $locationSource,
        'latitude' => $latitude,
        'longitude' => $longitude,
        'automatic_alerts' => $alerts
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Sensor Reading Insert Error: ' . $e->getMessage());

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
