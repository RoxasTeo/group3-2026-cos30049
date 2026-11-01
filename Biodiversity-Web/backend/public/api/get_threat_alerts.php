
<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {

    $stmt = $db->query("
        SELECT
            alert_id,
            tracking_assignment_id,
            plant_id,
            alert_type,
            message,
            latitude,
            longitude,
            created_at
        FROM threat_alerts
        ORDER BY
            created_at DESC,
            alert_id DESC
    ");

    $alerts = $stmt->fetchAll();

    respond(200, $alerts);

} catch (PDOException $e) {

    error_log(
        'Threat Alert Retrieval Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Internal threat alert retrieval failure.'
    ]);
}
