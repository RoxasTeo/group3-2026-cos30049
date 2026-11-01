<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {
    $stmt = $db->query("
        SELECT
            sr.reading_id,
            sr.species_id,
            s.common_name,
            s.scientific_name,
            sr.temperature,
            sr.humidity,
            sr.soil_moisture_raw,
            sr.soil_moisture_percent,
            sr.recorded_at
        FROM sensor_readings sr
        INNER JOIN species s
            ON s.species_id = sr.species_id
        ORDER BY
            sr.recorded_at DESC,
            sr.reading_id DESC
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