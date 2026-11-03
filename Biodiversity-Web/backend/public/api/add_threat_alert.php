<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

$expectedKey = getenv('IOT_DEVICE_API_KEY');
$providedKey = $_SERVER['HTTP_X_DEVICE_KEY'] ?? '';

if (!$expectedKey || !hash_equals($expectedKey, $providedKey)) {
    respond(401, [
        'error' => 'Invalid device API key.'
    ]);
}

$data = jsonBody();

// Get device code instead of plant_id.
$deviceCode = trim($data['device_code'] ?? '');

if (
    $deviceCode === '' ||
    strlen($deviceCode) > 64
) {
    respond(400, [
        'error' => 'A valid device_code is required.'
    ]);
}


$alertType = trim($data['alert_type'] ?? '');

if ($alertType === '' || strlen($alertType) > 30) {
    respond(400, [
        'error' => 'Alert type is required and must not exceed 30 characters.'
    ]);
}

$message = trim($data['message'] ?? '');

if ($message === '' || strlen($message) > 255) {
    respond(400, [
        'error' => 'Alert message is required and must not exceed 255 characters.'
    ]);
}

$severity = $data['severity'] ?? 'warning';

if (!in_array($severity, ['info', 'warning', 'critical'], true)) {
    respond(400, [
        'error' => 'Severity must be info, warning or critical.'
    ]);
}

try {

    $pdo = database();

    $checkDevice = $pdo->prepare(
        "SELECT id
         FROM tracking_devices
         WHERE device_code = :device_code
           AND is_active = 1
         LIMIT 1"
    );

    $checkDevice->execute([
        ':device_code' => $deviceCode
    ]);

    $device = $checkDevice->fetch(PDO::FETCH_ASSOC);

    if (!$device) {
        respond(404, [
            'error' => 'Tracking device not found or inactive.'
        ]);
    }

    $checkAssignment = $pdo->prepare(
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

    $checkAssignment->execute([
        ':device_id' => $device['id']
    ]);

    $assignments = $checkAssignment->fetchAll(PDO::FETCH_ASSOC);

    if (count($assignments) === 0) {
        respond(400, [
            'error' => 'This device has no active tracking assignment.'
        ]);
    }

    if (count($assignments) > 1) {
        respond(409, [
            'error' => 'Multiple active tracking assignments found for this device.'
        ]);
    }

    $assignment = $assignments[0];

    $assignmentId = $assignment['tracking_assignment_id'];
    $plantId = $assignment['plant_id'];

    $latitude = $assignment['latitude'];
    $longitude = $assignment['longitude'];

    $stmt = $pdo->prepare(
        "INSERT INTO threat_alerts (
            tracking_assignment_id,
            plant_id,
            alert_type,
            severity,
            message,
            latitude,
            longitude
        ) VALUES (
            :assignment_id,
            :plant_id,
            :alert_type,
            :severity,
            :message,
            :latitude,
            :longitude
        )"
    );

    $stmt->execute([
        ':assignment_id' => $assignmentId,
        ':plant_id' => $plantId,
        ':alert_type' => $alertType,
        ':severity' => $severity,
        ':message' => $message,
        ':latitude' => $latitude,
        ':longitude' => $longitude
    ]);

    respond(201, [
        'message' => 'Threat alert saved successfully.',
        'alert_id' => $pdo->lastInsertId(),
        'device_code' => $deviceCode,
        'tracking_assignment_id' => $assignmentId,
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
