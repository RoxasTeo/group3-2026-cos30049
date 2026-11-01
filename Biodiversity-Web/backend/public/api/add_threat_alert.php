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
// READ JSON REQUEST
// ==========================================

$body = jsonBody();

// ==========================================
// VALIDATE PLANT ID
// ==========================================

if (
    !array_key_exists('plant_id', $body) ||
    filter_var($body['plant_id'], FILTER_VALIDATE_INT) === false
) {
    respond(400, [
        'error' => 'Missing or invalid field: plant_id'
    ]);
}

$plantId = (int) $body['plant_id'];

if ($plantId < 1) {
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
// VALIDATE ALERT TYPE AND MESSAGE
// ==========================================

$required = [
    'alert_type',
    'message'
];

foreach ($required as $field) {

    if (
        !array_key_exists($field, $body) ||
        !is_string($body[$field]) ||
        trim($body[$field]) === ''
    ) {
        respond(400, [
            'error' => "Missing or invalid field: $field"
        ]);
    }
}

// ==========================================
// VALIDATE AND SANITIZE INPUT
// ==========================================

$alertType = trim($body['alert_type']);
$message = trim($body['message']);

if (
    strlen($alertType) > 30 ||
    strlen($message) > 255
) {
    respond(400, [
        'error' => 'Alert values are invalid or too long.'
    ]);
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
    // INSERT THREAT ALERT
    // ======================================

    $sql = "INSERT INTO threat_alerts (
                tracking_assignment_id,
                plant_id,
                alert_type,
                message
            ) VALUES (
                :tracking_assignment_id,
                :plant_id,
                :alert_type,
                :message
            )";

    $stmt = $db->prepare($sql);

    $stmt->execute([
        ':tracking_assignment_id' => $trackingAssignmentId,
        ':plant_id' => $plantId,
        ':alert_type' => $alertType,
        ':message' => $message
    ]);

    // ======================================
    // SUCCESS RESPONSE
    // ======================================

    respond(201, [
        'status' => 'success',
        'message' => 'Threat alert successfully recorded.',
        'alert_id' => (int) $db->lastInsertId(),
        'plant_id' => $plantId,
        'tracking_assignment_id' => $trackingAssignmentId,
        'alert_type' => $alertType,
        'alert_message' => $message
    ]);

} catch (PDOException $e) {

    error_log(
        'Threat Alert Insert Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Database storage failure.'
    ]);
}
