<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable local test database required.');
$fixtures = [
    ['Distribution Test Meranti', 'Shorea distribution-test', 'Dipterocarpaceae', 'Vulnerable'],
    ['Distribution Test Fern', 'Diplazium distribution-test', 'Athyriaceae', 'Least Concern'],
    ['Distribution Test Palm', 'Licuala distribution-test', 'Arecaceae', 'Not Evaluated'],
];
$ids = [];
foreach ($fixtures as $fixture) {
    $stmt = database()->prepare('SELECT species_id FROM species WHERE common_name = ? ORDER BY species_id LIMIT 1');
    $stmt->execute([$fixture[0]]); $id = $stmt->fetchColumn();
    if (!$id) {
        $stmt = database()->prepare('INSERT INTO species (common_name, scientific_name, family, status, description) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([...$fixture, 'Explicitly fictional isolated test fixture.']);
        $id = database()->lastInsertId();
    }
    $ids[] = (int) $id;
}
echo json_encode($ids, JSON_THROW_ON_ERROR);
