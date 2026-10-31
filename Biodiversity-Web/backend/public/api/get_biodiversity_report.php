<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['GET']);
// Reports must enforce current account status/role on the server, not only in Vue.
requireRole(['conservation_officer', 'admin']);
$stmt = database()->query('SELECT species_id, common_name, scientific_name, family, genus, status,
    habitat, description, ecological_info, cultural_sign, updated_at FROM species
    ORDER BY scientific_name, species_id');
respond(200, $stmt->fetchAll());
