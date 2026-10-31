<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {
    $stmt = $db->query("SELECT t.reading_id, t.plant_id AS species_id, t.tracking_assignment_id, t.temperature, t.humidity, t.distance_cm, t.latitude, t.longitude, t.recorded_at, p.plant_tag, d.device_code FROM sensor_readings t LEFT JOIN tracking_assignments a ON a.id=t.tracking_assignment_id LEFT JOIN tracked_plants p ON p.id=a.plant_id LEFT JOIN tracking_devices d ON d.id=a.device_id ORDER BY t.recorded_at DESC, t.reading_id DESC");

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
