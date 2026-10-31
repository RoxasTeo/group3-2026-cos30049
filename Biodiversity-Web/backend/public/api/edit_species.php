<?php
require_once __DIR__ . '/../../species.php';
api(['POST']);
requireRole(['conservation_officer', 'admin']);
requireCsrf();
$input = speciesInput(jsonBody(2 * 1024 * 1024));
$db = database();
$id = observationId($_GET['id'] ?? null);
// Lock the row so concurrent deletion cannot produce a false success response.
try {
    $db->beginTransaction();
    $stmt = $db->prepare('SELECT species_id FROM species WHERE species_id = ? FOR UPDATE');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) { $db->rollBack(); respond(404, ['error' => 'Species not found.']); }
    $assignments = array_map(fn($key) => $key . ' = ?', array_keys($input));
    $stmt = $db->prepare('UPDATE species SET ' . implode(', ', $assignments) . ' WHERE species_id = ?');
    $stmt->execute([...array_values($input), $id]);
    $db->commit();
} catch (Throwable $error) { if ($db->inTransaction()) $db->rollBack(); throw $error; }
respond(200, ['status' => 'success', 'message' => 'Species updated.']);
