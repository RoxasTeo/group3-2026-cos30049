<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {
    $stmt = $db->query("SELECT t.alert_id, t.plant_id AS species_id, t.tracking_assignment_id, t.alert_type, t.severity, t.message, t.latitude, t.longitude, t.created_at, p.plant_tag, d.device_code FROM threat_alerts t LEFT JOIN tracking_assignments a ON a.id=t.tracking_assignment_id LEFT JOIN tracked_plants p ON p.id=a.plant_id LEFT JOIN tracking_devices d ON d.id=a.device_id ORDER BY t.created_at DESC, t.alert_id DESC");

    $alerts = $stmt->fetchAll();

    respond(200, $alerts);

} catch (\PDOException $e) {
    error_log(
        'Threat Alert Retrieval Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Internal threat alert retrieval failure.'
    ]);
}