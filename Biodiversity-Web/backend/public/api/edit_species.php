<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']); 
requireCsrf();

if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['conservation_officer', 'admin'], true)) {
    respond(403, ['error' => 'Access Denied: Insufficient write privileges.']);
}

$target_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
if (!$target_id) {
    respond(400, ['error' => 'Missing row identifier parameter (?id=).']);
}

$body = jsonBody();
$clean_status = (!isset($body['status']) || trim($body['status']) === '') ? 'Not Evaluated' : trim($body['status']);
$clean_description = (!isset($body['description']) || trim($body['description']) === '') ? 'No description provided.' : trim($body['description']);

$db = database();
try {
    $sql = "UPDATE species SET 
                common_name = :common_name, 
                scientific_name = :scientific_name, 
                family = :family, 
                genus = :genus, 
                status = :status, 
                habitat = :habitat, 
                description = :description, 
                ecological_info = :ecological_info, 
                cultural_sign = :cultural_sign, 
                photo = :photo, 
                photo_name = :photo_name
            WHERE species_id = :species_id";
    
    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':common_name'      => trim($body['common_name']),
        ':scientific_name'  => trim($body['scientific_name']),
        ':family'           => trim($body['family']),
        ':genus'            => !empty($body['genus']) ? trim($body['genus']) : null,
        ':status'           => $clean_status,
        ':habitat'          => !empty($body['habitat']) ? trim($body['habitat']) : null,
        ':description'      => $clean_description,
        ':ecological_info'  => !empty($body['ecological_info']) ? trim($body['ecological_info']) : null,
        ':cultural_sign'    => !empty($body['cultural_sign']) ? trim($body['cultural_sign']) : null,
        ':photo'            => !empty($body['photo']) ? $body['photo'] : null,
        ':photo_name'       => !empty($body['photo_name']) ? trim($body['photo_name']) : null,
        ':species_id'       => $target_id
    ]);

    respond(200, ['status' => 'success', 'message' => 'Record successfully updated.']);
} catch (\PDOException $e) {
    error_log('Database Update Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database mutation failure.']);
}
