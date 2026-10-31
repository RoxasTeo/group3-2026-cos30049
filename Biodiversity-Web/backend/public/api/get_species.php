<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['GET']);

requireRole(['user', 'conservation_officer', 'admin']);

$db = database();
$target_id = isset($_GET['id']) ? filter_var($_GET['id'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) : null;
if ($target_id === false) respond(400, ['error' => 'Invalid species ID.']);
try {
    if ($target_id) {
        $stmt = $db->prepare("SELECT * FROM species WHERE species_id = ?");
        $stmt->execute([$target_id]);
        $record = $stmt->fetch();
        
        if (!$record) {
            respond(404, ['error' => 'Target species record does not exist.']);
        }
        
        respond(200, $record);
        
    } else {
        $stmt = $db->query("
            SELECT 
                species_id, common_name, scientific_name, family, genus, 
                status, habitat, description, ecological_info, cultural_sign, 
                photo, photo_name, updated_at 
            FROM species 
            ORDER BY common_name ASC
        ");
        
        $speciesList = $stmt->fetchAll();
        respond(200, $speciesList);
    }
} catch (\PDOException $e) {
    error_log('Database Retrieval Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database operational retrieval failure.']);
}
