<?php
declare(strict_types=1);
// Additive local demo: existing users and observations are never overwritten.
require_once __DIR__ . '/../observations.php';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (setting('APP_ENV') !== 'development') throw new RuntimeException('This demo requires APP_ENV=development.');
$db = database();
assertDatabaseKey($db);
$email = 'botanist2@niah.demo';
$db->beginTransaction();
try {
    $find = $db->prepare('SELECT id, role, is_active FROM users WHERE email_lookup = ?');
    $find->execute([emailLookup($email)]);
    $existing = $find->fetch();
    if ($existing && ($existing['role'] !== 'botanist' || !$existing['is_active'])) throw new RuntimeException('Existing demo account is not an active botanist; no changes made.');
    $owner = $existing ? (int) $existing['id'] : createProtectedUser($db, 'Demo Botanist Two', $email, password_hash('NiahDemo@2026', PASSWORD_BCRYPT, ['cost' => 10]), 'botanist');
    $rows = [
        ['NIAH-DEMO-B2-001', 'Bird nest fern — DEMO', 'Asplenium nidus', 'Aspleniaceae', 0.6, 'Broad green fronds in a rosette.'],
        ['NIAH-DEMO-B2-002', 'Pitcher plant — DEMO', 'Nepenthes ampullaria', 'Nepenthaceae', 0.3, 'Small rounded pitchers near ground level.'],
        ['NIAH-DEMO-B2-003', 'Unidentified seedling — DEMO', '', '', 0.2, 'Young seedling with several green leaves.'],
    ];
    $findRecord = $db->prepare('SELECT id FROM observations WHERE submitted_by = ? AND client_reference = ?');
    $insert = $db->prepare('INSERT INTO observations (submitted_by, client_reference, plant_tag, common_name, scientific_name, family, field_notes, habitat, morphology, conservation_status, height_m, latitude, longitude, accuracy_m, location_captured_at, photos, photo_count, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, 0, ?, UTC_TIMESTAMP())');
    $added = 0;
    foreach ($rows as $i => [$tag, $name, $scientific, $family, $height, $morphology]) {
        $findRecord->execute([$owner, $tag]);
        if ($findRecord->fetchColumn()) continue;
        $insert->execute([$owner, $tag, $tag, $name, $scientific, $family,
            protectData('FICTIONAL DEMO observation by Botanist Two. Identification, measurements and coordinates are illustrative; not a verified field survey.', 'observations.field_notes:' . $owner . ':' . $tag),
            protectData('Demo habitat: shaded forest trail. Not an actual observation location.', 'observations.habitat:' . $owner . ':' . $tag),
            $morphology, 'Not assessed', $height, 3.816 + $i * 0.001, 113.774 + $i * 0.001, 8, '[]', 'Pending']);
        $added++;
    }
    $db->commit();
    echo ($existing ? 'Kept existing account: ' : 'Created account: ') . $email . PHP_EOL;
    echo "Added $added fictional observations; collector ID $owner. Existing data preserved." . PHP_EOL;
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}
