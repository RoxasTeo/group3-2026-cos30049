<?php
declare(strict_types=1);

require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

// Require an authenticated user.
$user = requireLogin();

$db = database();

try {
    // Optional filter by species ID.
    $speciesId = null;

    if (isset($_GET['species_id'])) {
        $speciesId = filter_var(
            $_GET['species_id'],
            FILTER_VALIDATE_INT
        );

        if ($speciesId === false || $speciesId < 1) {
            respond(400, [
                'error' => 'Invalid species_id.'
            ]);
        }
    }

    // Optional limit.
    $limit = 100;

    if (isset($_GET['limit'])) {
        $requestedLimit = filter_var(
            $_GET['limit'],
            FILTER_VALIDATE_INT
        );

        if (
            $requestedLimit === false ||
            $requestedLimit < 1 ||
            $requestedLimit > 500
        ) {
            respond(400, [
                'error' => 'Limit must be between 1 and 500.'
            ]);
        }

        $limit = $requestedLimit;
    }

    $sql = "SELECT
                ta.alert_id,
                ta.species_id,
                s.common_name,
                s.scientific_name,
                ta.alert_type,
                ta.message,
                ta.created_at
            FROM threat_alerts ta
            INNER JOIN species s
                ON ta.species_id = s.species_id";

    $params = [];

    if ($speciesId !== null) {
        $sql .= " WHERE ta.species_id = :species_id";
        $params[':species_id'] = $speciesId;
    }

    $sql .= " ORDER BY ta.created_at DESC
              LIMIT " . (int) $limit;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $alerts = $stmt->fetchAll();

    respond(200, [
        'status' => 'success',
        'count' => count($alerts),
        'alerts' => $alerts
    ]);

} catch (PDOException $e) {
    error_log(
        'Get Threat Alerts Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Unable to retrieve threat alerts.'
    ]);
}
