<?php
declare(strict_types=1);
// Local demo accounts and sample data. Never run against a production database.
// Usage: php Biodiversity-Web/backend/bin/seed-demo.php
// Safe to re-run: existing demo accounts are kept, and sample data is only added to a database without any.
require_once __DIR__ . '/../observations.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (setting('APP_ENV') === 'production') { fwrite(STDERR, "Refusing to add demo data when APP_ENV=production.\n"); exit(1); }

const DEMO_PASSWORD = 'NiahDemo@2026';
const DEMO_ACCOUNTS = [
    ['officer@niah.demo', 'Demo Officer', 'conservation_officer'],
    ['botanist@niah.demo', 'Demo Botanist', 'botanist'],
    ['admin@niah.demo', 'Demo Administrator', 'admin'],
];

// A small solid-colour PNG, so sample observations have a valid photograph without shipping image files.
function demoPhoto(array $rgb, int $width = 96, int $height = 72): string {
    $chunk = fn(string $type, string $data): string => pack('N', strlen($data)) . $type . $data . pack('N', crc32($type . $data));
    $rows = '';
    for ($y = 0; $y < $height; $y++) {
        $rows .= "\0";
        $shade = 0.75 + 0.25 * $y / $height;
        for ($x = 0; $x < $width; $x++) $rows .= pack('C3', ...array_map(fn(int $c): int => (int) min(255, $c * $shade), $rgb));
    }
    $png = "\x89PNG\r\n\x1a\n" . $chunk('IHDR', pack('NNC5', $width, $height, 8, 2, 0, 0, 0)) . $chunk('IDAT', gzcompress($rows)) . $chunk('IEND', '');
    return 'data:image/png;base64,' . base64_encode($png);
}

$db = database();
// On an empty database this initialises encryption with this computer's key, like the first CLI account.
assertDatabaseKey($db, true);
$ids = [];
foreach (DEMO_ACCOUNTS as [$email, $name, $role]) {
    $stmt = $db->prepare('SELECT id FROM users WHERE email_lookup = ?');
    $stmt->execute([emailLookup($email)]);
    $id = $stmt->fetchColumn();
    if ($id) { echo "Account exists: $email\n"; $ids[$role] = (int) $id; continue; }
    $ids[$role] = createProtectedUser($db, $name, $email, password_hash(DEMO_PASSWORD, PASSWORD_BCRYPT, ['cost' => 10]), $role);
    echo "Account created: $email ($role)\n";
}

$hasData = (int) $db->query('SELECT (SELECT COUNT(*) FROM species) + (SELECT COUNT(*) FROM observations) + (SELECT COUNT(*) FROM tracked_plants)')->fetchColumn();
if ($hasData > 0) { echo "Sample data skipped: the database already has species, observations or tracked plants.\n"; exit(0); }

$db->beginTransaction();
try {
    // Species knowledge base. Conservation statuses follow the IUCN Red List; descriptions are short demo text.
    $species = [
        ['Bornean ironwood', 'Eusideroxylon zwageri', 'Lauraceae', 'Eusideroxylon', 'Vulnerable', 'Lowland dipterocarp forest',
            'Slow-growing hardwood tree with extremely dense, rot-resistant timber.', 'Canopy tree of lowland forest; heavily logged for its timber.', 'Known locally as belian; used for traditional longhouse posts.'],
        ['Agarwood', 'Aquilaria malaccensis', 'Thymelaeaceae', 'Aquilaria', 'Critically Endangered', 'Lowland and hill forest',
            'Evergreen tree whose infected heartwood forms fragrant resin.', 'Wild populations are declining because trees are felled for resin.', 'Resin (gaharu) is valued for incense and perfume.'],
        ['Flask-shaped pitcher plant', 'Nepenthes ampullaria', 'Nepenthaceae', 'Nepenthes', 'Least Concern', 'Shaded peat swamp and kerangas forest floor',
            'Carnivorous plant forming clusters of round, squat ground pitchers.', 'Pitchers collect falling leaf litter as a nutrient source.', ''],
        ["Raffles' pitcher plant", 'Nepenthes rafflesiana', 'Nepenthaceae', 'Nepenthes', 'Least Concern', 'Open heath forest and forest edges',
            'Climbing pitcher plant with large, mottled upper pitchers.', 'Attracts insects with nectar along the pitcher rim.', ''],
        ['Rafflesia', 'Rafflesia tuan-mudae', 'Rafflesiaceae', 'Rafflesia', 'Not Evaluated', 'Hill forest on Tetrastigma host vines',
            'Parasitic plant with a very large, five-lobed red flower and no leaves.', 'Lives inside its host vine and only emerges to flower.', ''],
    ];
    $stmt = $db->prepare('INSERT INTO species (common_name, scientific_name, family, genus, status, habitat, description, ecological_info, cultural_sign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $speciesIds = [];
    foreach ($species as $row) { $stmt->execute($row); $speciesIds[$row[1]] = (int) $db->lastInsertId(); }

    // Field observations by the demo botanist, in each review state. Text fields are encrypted like real uploads.
    $observations = [
        ['NIAH-DEMO-001', 'Eusideroxylon zwageri', 'Bornean ironwood', 'Lauraceae', 'Mature tree with buttress roots beside the Painted Cave trail.', 'Lowland forest near the trail, closed canopy.', 'Smooth reddish-brown bark; simple alternate leaves.', 'Vulnerable', 28.0, 3.8160, 113.7745, 'Approved', 'Clear photographs and location. Approved for the species map.', 30],
        ['NIAH-DEMO-002', 'Aquilaria malaccensis', 'Agarwood', 'Thymelaeaceae', 'Young tree with a fresh cut in the bark, possibly tested for resin.', 'Hill forest slope above the river.', 'Thin grey bark; glossy elliptic leaves.', 'Critically Endangered', 9.5, 3.8204, 113.7812, 'Changes requested', 'Please add a close-up of the bark damage and confirm the GPS accuracy.', 6],
        ['NIAH-DEMO-003', 'Nepenthes ampullaria', 'Flask-shaped pitcher plant', 'Nepenthaceae', 'Cluster of about twenty ground pitchers in leaf litter.', 'Shaded peat swamp edge, wet ground.', 'Round green pitchers with red speckles.', 'Least Concern', 0.3, 3.8133, 113.7698, 'Pending', '', 2],
        ['NIAH-DEMO-004', '', 'Unidentified plant', '', 'Unknown climbing plant with large heart-shaped leaves; identification needed.', 'Limestone outcrop near the cave entrance.', 'Twining stem; leaves about 20 cm long.', '', 4.0, 3.8178, 113.7760, 'Pending', '', 1],
    ];
    $colours = [[96, 120, 70], [120, 96, 70], [70, 130, 90], [90, 110, 120]];
    $insert = $db->prepare('INSERT INTO observations (submitted_by, client_reference, plant_tag, species_id, common_name, scientific_name, family, field_notes, habitat, morphology, conservation_status, height_m, latitude, longitude, accuracy_m, location_captured_at, photos, photo_count, status, version, submitted_at, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $review = $db->prepare('INSERT INTO observation_reviews (observation_id, reviewer_id, decision, notes, checks, observation_version, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)');
    $botanist = $ids['botanist'];
    foreach ($observations as $index => [$tag, $scientific, $common, $family, $notes, $habitat, $morphology, $status, $height, $lat, $lon, $decision, $reviewNotes, $daysAgo]) {
        $submitted = gmdate('Y-m-d H:i:s', time() - $daysAgo * 86400);
        $reviewed = $decision === 'Pending' ? null : gmdate('Y-m-d H:i:s', time() - $daysAgo * 86400 + 86400);
        $photos = [['data_url' => demoPhoto($colours[$index]), 'caption' => 'Demo photograph', 'file_name' => strtolower($tag) . '-1.png']];
        $insert->execute([
            $botanist, $tag, $tag, $speciesIds[$scientific] ?? null, $common, $scientific, $family,
            protectData($notes, 'observations.field_notes:' . $botanist . ':' . $tag), protectData($habitat, 'observations.habitat:' . $botanist . ':' . $tag),
            $morphology, $status, $height, $lat, $lon, 8.0, $submitted, json_encode($photos, JSON_THROW_ON_ERROR), count($photos),
            $decision, $decision === 'Pending' ? 1 : 2, $submitted, $reviewed,
        ]);
        if ($decision === 'Pending') continue;
        $id = (int) $db->lastInsertId();
        $checks = $decision === 'Approved' ? ['notes' => true, 'photos' => true, 'gps' => true] : ['notes' => true, 'photos' => false, 'gps' => false];
        $review->execute([$id, $ids['conservation_officer'], $decision,
            protectData($reviewNotes, reviewNotesContext(['observation_id' => $id, 'observation_version' => 1, 'reviewer_id' => $ids['conservation_officer']])),
            json_encode($checks, JSON_THROW_ON_ERROR), $reviewed]);
    }

    // IoT: two tracked plants with sensors, 24 hours of readings and a few alerts.
    $plants = [['NIAH-TRK-01', 'Ironwood by the Painted Cave trail', 'Eusideroxylon zwageri', 3.8160, 113.7745], ['NIAH-TRK-02', 'Agarwood on the river slope', 'Aquilaria malaccensis', 3.8204, 113.7812]];
    foreach ($plants as $n => [$tag, $label, $scientific, $lat, $lon]) {
        $db->prepare('INSERT INTO tracked_plants (species_id, plant_tag, label, latitude, longitude) VALUES (?, ?, ?, ?, ?)')->execute([$speciesIds[$scientific], $tag, $label, $lat, $lon]);
        $plantId = (int) $db->lastInsertId();
        // The device key is never shown; rotate it on the Monitoring page to connect a real sensor.
        $db->prepare('INSERT INTO tracking_devices (device_code, name, key_hash, is_active) VALUES (?, ?, ?, 1)')->execute(['DEMO-ESP32-0' . ($n + 1), 'Demo ESP32 sensor ' . ($n + 1), hash('sha256', bin2hex(random_bytes(32)))]);
        $deviceId = (int) $db->lastInsertId();
        $db->prepare('INSERT INTO tracking_assignments (device_id, plant_id, started_at) VALUES (?, ?, NOW() - INTERVAL 2 DAY)')->execute([$deviceId, $plantId]);
        $assignmentId = (int) $db->lastInsertId();
        $reading = $db->prepare('INSERT INTO sensor_readings (tracking_assignment_id, plant_id, temperature, humidity, soil_moisture_raw, soil_moisture_raw_percent, distance_cm, location_source, latitude, longitude, recorded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? HOUR)');
        for ($hour = 24; $hour >= 0; $hour--) {
            $temperature = round(25 + 4 * sin(($hour - 6) / 24 * 2 * M_PI) + $n, 2);
            $humidity = round(82 - 10 * sin(($hour - 6) / 24 * 2 * M_PI), 2);
            $moisture = 1800 + 15 * $hour + 40 * $n;
            // Someone approaches the second plant two hours ago.
            $distance = $n === 1 && $hour === 2 ? 15.0 : 160.0 + ($hour % 3);
            $reading->execute([$assignmentId, $plantId, $temperature, $humidity, $moisture, round(100 - $moisture / 40.95, 2), $distance, 'device', $lat + 0.00002 * ($hour % 2), $lon, $hour]);
        }
        $alert = $db->prepare('INSERT INTO threat_alerts (tracking_assignment_id, plant_id, alert_type, severity, message, latitude, longitude, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? HOUR)');
        if ($n === 1) {
            $alert->execute([$assignmentId, $plantId, 'proximity', 'critical', 'Automatic [proximity]: Distance 15 cm within configured proximity threshold.', $lat, $lon, 2]);
            $alert->execute([$assignmentId, $plantId, 'manual', 'warning', 'Fresh cut on the bark reported by a ranger.', $lat, $lon, 20]);
        } else {
            $alert->execute([$assignmentId, $plantId, 'humidity', 'info', 'Humidity dropped during the afternoon; no action needed.', $lat, $lon, 9]);
        }
    }
    $db->commit();
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}
echo "Sample data added: 5 species, 4 observations, 2 tracked plants with sensor readings and alerts.\n";
