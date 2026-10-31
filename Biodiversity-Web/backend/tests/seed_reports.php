<?php
require_once __DIR__ . '/../bootstrap.php';
if (PHP_SAPI !== 'cli' || setting('REVIEW_TEST_FIXTURES') !== '1' || !str_ends_with(setting('DB_NAME'), '_test') || setting('DB_HOST') !== '127.0.0.1') throw new RuntimeException('Disposable local test database required.');
$values = ['Report export fixture', 'Reportus export-test', 'Exportaceae', 'Reportus', 'Endangered', 'Test habitat', "Text, with \"quotes\"\nand a new line", '=1+1', 'Sarawak / 沙捞越'];
$stmt = database()->prepare('SELECT species_id FROM species WHERE common_name = ? ORDER BY species_id LIMIT 1');
$stmt->execute([$values[0]]); $id = $stmt->fetchColumn();
if ($id) {
    $stmt = database()->prepare('UPDATE species SET common_name=?, scientific_name=?, family=?, genus=?, status=?, habitat=?, description=?, ecological_info=?, cultural_sign=? WHERE species_id=?');
    $stmt->execute([...$values, $id]);
} else {
    $stmt = database()->prepare('INSERT INTO species (common_name,scientific_name,family,genus,status,habitat,description,ecological_info,cultural_sign) VALUES (?,?,?,?,?,?,?,?,?)');
    $stmt->execute($values); $id = database()->lastInsertId();
}
echo (int) $id;
