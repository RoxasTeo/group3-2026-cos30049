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

// Validate alert type
$alertType = trim($data['alert_type'] ?? '');

if ($alertType === '' || strlen($alertType) > 30) {
    respond(400, [
        'error' => 'Alert type is required and must not exceed 30 characters.'
    ]);
}

// Validate alert message
$message = trim($data['message'] ?? '');

if ($message === '' || strlen($message) > 255) {
    respond(400, [
        'error' => 'Alert message is required and must not exceed 255 characters.'
    ]);
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

    // Get registered coordinates from tracked_plants
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

    // Insert threat alert
    $stmt = $pdo->prepare(
        "INSERT INTO threat_alerts (
            tracking_assignment_id,
            plant_id,
            alert_type,
            message,
            latitude,
            longitude
        ) VALUES (
            :assignment_id,
            :plant_id,
            :alert_type,
            :message,
            :latitude,
            :longitude
        )"
    );

    $stmt->execute([
        ':assignment_id' => $assignmentId,
        ':plant_id' => $plantId,
        ':alert_type' => $alertType,
        ':message' => $message,
        ':latitude' => $latitude,
        ':longitude' => $longitude
    ]);

    respond(201, [
        'message' => 'Threat alert saved successfully.',
        'alert_id' => $pdo->lastInsertId(),
        'plant_id' => $plantId,
        'alert_type' => $alertType,
        'latitude' => $latitude,
        'longitude' => $longitude
    ]);

} catch (PDOException $e) {
    error_log('Threat Alert Insert Error: ' . $e->getMessage());

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
