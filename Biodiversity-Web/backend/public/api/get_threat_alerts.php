<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['admin', 'conservation_officer']);

$db = database();

try {
    $stmt = $db->query("
        SELECT
            ta.alert_id,
            ta.species_id,
            s.common_name,
            s.scientific_name,
            ta.alert_type,
            ta.message,
            ta.created_at
        FROM threat_alerts ta
        INNER JOIN species s
            ON s.species_id = ta.species_id
        ORDER BY
            ta.created_at DESC,
            ta.alert_id DESC
    ");

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