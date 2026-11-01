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

// Validate and sanitize input.
$speciesId = filter_var(
    $body['species_id'],
    FILTER_VALIDATE_INT
);

$alertType = trim($body['alert_type']);
$message = trim($body['message']);

// Check database column lengths.
if (
    $speciesId === false ||
    $speciesId < 1 ||
    strlen($alertType) > 30 ||
    strlen($message) > 255
) {
    respond(400, [
        'error' => 'Alert values are invalid or too long.'
    ]);
}

$db = database();

try {
    // Confirm that the species exists.
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

    // Insert the threat alert.
    $sql = "INSERT INTO threat_alerts (
                species_id,
                alert_type,
                message
            ) VALUES (
                :species_id,
                :alert_type,
                :message
            )";

    $stmt = $db->prepare($sql);

    $stmt->execute([
        ':species_id' => $speciesId,
        ':alert_type' => $alertType,
        ':message' => $message
    ]);

    respond(201, [
        'status' => 'success',
        'message' => 'Threat alert successfully recorded.',
        'alert_id' => (int) $db->lastInsertId(),
        'common_name' => $species['common_name'],
        'scientific_name' => $species['scientific_name'],
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
