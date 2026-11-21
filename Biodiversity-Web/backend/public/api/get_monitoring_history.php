
<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);
requireRole(['admin', 'conservation_officer']);

// ==========================================
// DATE VALIDATION
// ==========================================

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

// ==========================================
// SPECIES ID VALIDATION
// ==========================================

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

// ==========================================
// QUERY FILTERS
// ==========================================

$params = [
    $start->format('Y-m-d'),
    $end->modify('+1 day')->format('Y-m-d')
];

$where = 'r.recorded_at >= ? AND r.recorded_at < ?';

if ($id !== null) {
    $where .= ' AND tp.species_id = ?';
    $params[] = $id;
}

$db = database();

try {
    $db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->beginTransaction();

    // ==========================================
    // 1. SUMMARY STATISTICS
    // ==========================================

    $stmt = $db->prepare("
        SELECT
            COUNT(*) AS count,

            AVG(r.temperature) AS avg_temperature,
            MIN(r.temperature) AS min_temperature,
            MAX(r.temperature) AS max_temperature,

            AVG(r.humidity) AS avg_humidity,
            MIN(r.humidity) AS min_humidity,
            MAX(r.humidity) AS max_humidity,

            AVG(r.soil_moisture_raw_percent)
                AS avg_soil_moisture_raw_percent,

            MIN(r.soil_moisture_raw_percent)
                AS min_soil_moisture_raw_percent,

            MAX(r.soil_moisture_raw_percent)
                AS max_soil_moisture_raw_percent

        FROM sensor_readings r

        INNER JOIN tracked_plants tp
            ON tp.id = r.plant_id

        WHERE $where
    ");

    $stmt->execute($params);
    $summary = $stmt->fetch(PDO::FETCH_ASSOC);

    $summary['count'] = (int) $summary['count'];

    foreach ($summary as $key => $value) {
        if ($key !== 'count') {
            $summary[$key] = $value === null
                ? null
                : (float) $value;
        }
    }

    // ==========================================
    // 2. DAILY OR MONTHLY MONITORING TRENDS
    // ==========================================

    $monthly = $days > 365;

    $bucket = $monthly
        ? "DATE_FORMAT(r.recorded_at, '%Y-%m-01')"
        : 'DATE(r.recorded_at)';

    $stmt = $db->prepare("
        SELECT
            $bucket AS bucket,

            COUNT(*) AS count,

            AVG(r.temperature) AS temperature,

            AVG(r.humidity) AS humidity,

            AVG(r.soil_moisture_raw_percent)
                AS soil_moisture_raw_percent

        FROM sensor_readings r

        INNER JOIN tracked_plants tp
            ON tp.id = r.plant_id

        WHERE $where

        GROUP BY bucket
        ORDER BY bucket
    ");

    $stmt->execute($params);
    $trend = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($trend as &$point) {
        $point['count'] = (int) $point['count'];

        foreach (
            [
                'temperature',
                'humidity',
                'soil_moisture_raw_percent'
            ] as $metric
        ) {
            $point[$metric] = $point[$metric] === null
                ? null
                : (float) $point[$metric];
        }
    }

    unset($point);

    // ==========================================
    // 3. PAGINATION
    // ==========================================

    $pages = max(1, (int) ceil($summary['count'] / 50));

    $page = min($page, $pages);

    $offset = ($page - 1) * 50;

    // ==========================================
    // 4. RETRIEVE MONITORING READINGS
    // ==========================================

    $readingsParams = array_merge($params, [$offset]);

    $stmt = $db->prepare("
        SELECT
            r.reading_id,
            r.tracking_assignment_id,

            r.plant_id,
            tp.plant_tag,
            tp.label AS plant_label,

            tp.species_id,
            s.common_name,
            s.scientific_name,

            r.temperature,
            r.humidity,

            r.soil_moisture_raw,
            r.soil_moisture_raw_percent,

            r.latitude,
            r.longitude,

            r.recorded_at

        FROM sensor_readings r

        INNER JOIN tracked_plants tp
            ON tp.id = r.plant_id

        INNER JOIN species s
            ON s.species_id = tp.species_id

        WHERE $where

        ORDER BY r.recorded_at DESC, r.reading_id DESC

        LIMIT 50 OFFSET ?
    ");

    $stmt->execute($readingsParams);
    $readings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ==========================================
    // 5. SPECIES DROPDOWN OPTIONS
    // ==========================================

    $stmt = $db->query("
        SELECT DISTINCT
            s.species_id,
            s.common_name,
            s.scientific_name

        FROM sensor_readings r

        INNER JOIN tracked_plants tp
            ON tp.id = r.plant_id

        INNER JOIN species s
            ON s.species_id = tp.species_id

        ORDER BY s.common_name
    ");

    $options = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $db->commit();

} catch (Throwable $error) {

    if ($db->inTransaction()) {
        $db->rollBack();
    }

    error_log(
        'Monitoring History Retrieval Error: ' . $error->getMessage()
    );

    respond(500, [
        'error' => 'Unable to retrieve monitoring history.'
    ]);
}

// ==========================================
// RESPONSE
// ==========================================

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
