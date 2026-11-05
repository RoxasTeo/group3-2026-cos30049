<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['GET']);

requireRole(['user', 'conservation_officer', 'admin']);

$db = database();

$target_id = isset($_GET['id'])
    ? filter_var($_GET['id'], FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ])
    : null;

if ($target_id === false) {
    respond(400, ['error' => 'Invalid species ID.']);
}

try {
    if ($target_id) {

        // Retrieve one species record
        $stmt = $db->prepare("
            SELECT *
            FROM species
            WHERE species_id = ?
        ");

        $stmt->execute([$target_id]);
        $record = $stmt->fetch();

        if (!$record) {
            respond(404, [
                'error' => 'Target species record does not exist.'
            ]);
        }

        respond(200, $record);

    } else {

        // Retrieve all species with their user visibility status
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
                s.updated_at,

                CASE
                    WHEN uvs.species_id IS NOT NULL THEN 1
                    ELSE 0
                END AS is_visible

            FROM species s

            LEFT JOIN user_visible_species uvs
                ON s.species_id = uvs.species_id

            ORDER BY s.common_name ASC
        ");

        $speciesList = $stmt->fetchAll();

        respond(200, $speciesList);
    }

} catch (\PDOException $e) {

    error_log('Database Retrieval Error: ' . $e->getMessage());

    respond(500, [
        'error' => 'Internal database operational retrieval failure.'
    ]);
}
