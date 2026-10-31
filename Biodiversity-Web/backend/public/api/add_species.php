<?php
require_once __DIR__ . '/../../species.php';
api(['POST']);
requireRole(['conservation_officer', 'admin']);
requireCsrf();
$input = speciesInput(jsonBody(2 * 1024 * 1024));
$db = database();
$columns = array_keys($input);
$stmt = $db->prepare('INSERT INTO species (' . implode(', ', $columns) . ') VALUES (' . implode(', ', array_fill(0, count($columns), '?')) . ')');
$stmt->execute(array_values($input));
respond(201, ['status' => 'success', 'species_id' => (int) $db->lastInsertId(), 'message' => 'Species created.']);
