<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {

    $stmt = $db->query("
        SELECT
            reading_id,
            tracking_assignment_id,
            plant_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_raw_percent,
            latitude,
            longitude,
            recorded_at
        FROM sensor_readings
        ORDER BY
            recorded_at DESC,
            reading_id DESC
    ");

    $readings = $stmt->fetchAll();

    respond(200, $readings);

} catch (PDOException $e) {

    error_log(
        'Sensor Reading Retrieval Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Internal sensor reading retrieval failure.'
    ]);
}
