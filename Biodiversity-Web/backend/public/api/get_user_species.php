<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['user']);

$db = database();

try {
    $stmt = $db->query("
        SELECT
            s.species_id,
            s.common_name,
            s.scientific_name,
            s.family,
            s.genus,
            s.status,
            s.habitat,
            s.description,
            s.ecological_info,
            s.cultural_sign,
            s.photo,
            s.photo_name,
            s.updated_at
        FROM species s
        INNER JOIN user_visible_species uvs
            ON s.species_id = uvs.species_id
        ORDER BY s.common_name ASC
    ");

    $speciesList = $stmt->fetchAll();

    respond(200, $speciesList);

} catch (PDOException $e) {

    error_log('User Species Retrieval Error: ' . $e->getMessage());

    respond(500, [
        'error' => 'Failed to retrieve visible species.'
    ]);
}