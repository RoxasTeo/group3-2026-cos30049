<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['GET']);

if (!isset($_SESSION['role'])) {
    respond(404, ['error' => 'Authentication required. Please log in.']);
}

$current_role = $_SESSION['role'];
if ($current_role === 'botanist') {
    respond(403, ['error' => 'Access Denied: Botanists are restricted from accessing system utilities.']);
}

$db = database();
$target_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
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
