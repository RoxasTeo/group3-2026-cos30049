
<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);
requireRole(['admin', 'conservation_officer']);

function historyDate(string $key): DateTimeImmutable
{
    $raw = $_GET[$key] ?? '';

    if (!is_string($raw)) {
        respond(400, ['error' => 'Invalid date.']);
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $raw);

    if (!$date || $date->format('Y-m-d') !== $raw) {
        respond(400, ['error' => 'Use valid YYYY-MM-DD dates.']);
    }

    return $date;
}

$start = historyDate('start');
$end = historyDate('end');

$days = (int) $start->diff($end)->format('%r%a');

if ($days < 0 || $days > 3660) {
    respond(400, [
        'error' => 'Choose an ordered date range of no more than ten years.'
    ]);
}

// Validate species ID
$species = $_GET['species_id'] ?? '';

if (!is_string($species)) {
    respond(400, ['error' => 'Invalid species ID.']);
}

$id = $species === ''
    ? null
    : filter_var($species, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ]);

$page = filter_var($_GET['page'] ?? 1, FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1]
]);

if ($id === false || $page === false) {
    respond(400, ['error' => 'Invalid species ID or page.']);
}

$params = [
    $start->format('Y-m-d'),
    $end->modify('+1 day')->format('Y-m-d')
];

$where = 'recorded_at >= ? AND recorded_at < ?';

if ($id !== null) {
    $where .= ' AND species_id = ?';
    $params[] = $id;
}

$db = database();

try {
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();

    // 1. Summary statistics
    $stmt = $db->prepare("
        SELECT
            COUNT(*) AS count,
            AVG(temperature) AS avg_temperature,
            MIN(temperature) AS min_temperature,
            MAX(temperature) AS max_temperature,
            AVG(humidity) AS avg_humidity,
            MIN(humidity) AS min_humidity,
            MAX(humidity) AS max_humidity,
            AVG(soil_moisture_percent) AS avg_soil_moisture
        FROM sensor_readings
        WHERE $where
    ");

    $stmt->execute($params);
    $summary = $stmt->fetch();

    $summary['count'] = (int) $summary['count'];

    foreach ($summary as $key => $value) {
        if ($key !== 'count') {
            $summary[$key] = $value === null
                ? null
                : (float) $value;
        }
    }

    // 2. Daily or monthly trends
    $monthly = $days > 365;

    $bucket = $monthly
        ? "DATE_FORMAT(recorded_at, '%Y-%m-01')"
        : 'DATE(recorded_at)';

    $stmt = $db->prepare("
        SELECT
            $bucket AS bucket,
            COUNT(*) AS count,
            AVG(temperature) AS temperature,
            AVG(humidity) AS humidity,
            AVG(soil_moisture_percent) AS soil_moisture
        FROM sensor_readings
        WHERE $where
        GROUP BY bucket
        ORDER BY bucket
    ");

    $stmt->execute($params);
    $trend = $stmt->fetchAll();

    foreach ($trend as &$point) {
        $point['count'] = (int) $point['count'];

        foreach (
            ['temperature', 'humidity', 'soil_moisture']
            as $metric
        ) {
            $point[$metric] = $point[$metric] === null
                ? null
                : (float) $point[$metric];
        }
    }

    unset($point);

    // 3. Pagination
    $pages = max(1, (int) ceil($summary['count'] / 50));
    $page = min($page, $pages);

    $offset = ($page - 1) * 50;

    // 4. Retrieve sensor readings
    $stmt = $db->prepare("
        SELECT
            reading_id,
            species_id,
            temperature,
            humidity,
            soil_moisture_raw,
            soil_moisture_percent,
            recorded_at
        FROM sensor_readings
        WHERE $where
        ORDER BY recorded_at DESC, reading_id DESC
        LIMIT 50 OFFSET $offset
    ");

    $stmt->execute($params);
    $readings = $stmt->fetchAll();

    // 5. Species dropdown options
    $stmt = $db->query("
        SELECT DISTINCT
            r.species_id,
            s.common_name,
            s.scientific_name
        FROM sensor_readings r
        INNER JOIN species s
            ON s.species_id = r.species_id
        ORDER BY s.common_name
    ");

    $options = $stmt->fetchAll();

    $db->commit();

} catch (Throwable $error) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    error_log(
        'Sensor History Retrieval Error: ' . $error->getMessage()
    );

    respond(500, [
        'error' => 'Unable to retrieve sensor history.'
    ]);
}

respond(200, [
    'range' => [
        'start' => $start->format('Y-m-d'),
        'end' => $end->format('Y-m-d'),
        'species_id' => $id
    ],
    'interval' => $monthly ? 'month' : 'day',
    'time_basis' => 'Sensor recording time',
    'summary' => $summary,
    'trend' => $trend,
    'readings' => $readings,
    'species' => $options,
    'page' => $page,
    'pages' => $pages
]);
