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

    // Optional limit to control the number of returned records.
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
                ON sr.species_id = s.species_id";

    $params = [];

    if ($speciesId !== null) {
        $sql .= " WHERE sr.species_id = :species_id";
        $params[':species_id'] = $speciesId;
    }

    $sql .= " ORDER BY sr.recorded_at DESC
              LIMIT " . (int) $limit;

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    $readings = $stmt->fetchAll();

    respond(200, [
        'status' => 'success',
        'count' => count($readings),
        'readings' => $readings
    ]);

} catch (PDOException $e) {
    error_log(
        'Get Sensor Readings Error: ' . $e->getMessage()
    );

    respond(500, [
        'error' => 'Unable to retrieve sensor readings.'
    ]);
}
