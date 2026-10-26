<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

if (!isset($_SESSION['role'])) {
    respond(401, [
        'error' => 'Authentication required. Please log in.'
    ]);
}

$currentRole = $_SESSION['role'];

$allowedRoles = [
    'admin',
    'conservation_officer'
];

if (!in_array($currentRole, $allowedRoles, true)) {
    respond(403, [
        'error' => 'Access Denied: You are not authorized to access sensor readings.'
    ]);
}

$db = database();

try {
    $stmt = $db->query("
        SELECT
            reading_id,
            species_id,
            temperature,
            humidity,
            distance_cm,
            latitude,
            longitude,
            recorded_at
        FROM sensor_readings
        ORDER BY recorded_at DESC
    ");

    $readings = $stmt->fetchAll();

    respond(200, $readings);

} catch (\PDOException $e) {
    error_log(
        'Sensor Reading Retrieval Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Internal sensor reading retrieval failure.'
    ]);
}
