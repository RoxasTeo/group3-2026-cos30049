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
        'error' => 'Access Denied: You are not authorized to access threat alerts.'
    ]);
}

$db = database();

try {
    $stmt = $db->query("
        SELECT
            alert_id,
            species_id,
            alert_type,
            severity,
            message,
            latitude,
            longitude,
            created_at
        FROM threat_alerts
        ORDER BY created_at DESC
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