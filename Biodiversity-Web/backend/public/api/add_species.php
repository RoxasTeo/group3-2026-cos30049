<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();

if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['conservation_officer', 'admin'], true)) {
    respond(403, ['error' => 'Access Denied: Insufficient write privileges.']);
}

$body = jsonBody();
$req_common = $body['common_name'] ?? $body['commonName'] ?? null;
$req_scientific = $body['scientific_name'] ?? $body['scientificName'] ?? null;
$req_family = $body['family'] ?? null;

if (!is_string($req_common) || !is_string($req_scientific) || !is_string($req_family)) {
    respond(400, ['error' => 'Missing critical fields: common_name, scientific_name, and family are required.']);
}

$clean_status = (!isset($body['status']) || trim($body['status']) === '') ? 'Not Evaluated' : trim($body['status']);
$clean_description = (!isset($body['description']) || trim($body['description']) === '') ? 'No description provided.' : trim($body['description']);
$req_eco = $body['ecological_info'] ?? $body['ecologicalNotes'] ?? null;
$req_cultural = $body['cultural_sign'] ?? $body['culturalNotes'] ?? null;
$req_photo_name = $body['photo_name'] ?? $body['photoName'] ?? null;


$db = database();
try {
    $sql = "INSERT INTO species (
                common_name, scientific_name, family, genus, status, 
                habitat, description, ecological_info, cultural_sign, photo, photo_name
            ) VALUES (
                :common_name, :scientific_name, :family, :genus, :status, 
                :habitat, :description, :ecological_info, :cultural_sign, :photo, :photo_name
            )";
    
    $stmt = $db->prepare($sql);
    $stmt->execute([
        ':common_name'      => trim($req_common),
        ':scientific_name'  => trim($req_scientific),
        ':family'           => trim($req_family),
        ':genus'            => !empty($body['genus']) ? trim($body['genus']) : null,
        ':status'           => $clean_status,
        ':habitat'          => !empty($body['habitat']) ? trim($body['habitat']) : null,
        ':description'      => $clean_description,
        ':ecological_info'  => !empty($req_eco) ? trim($req_eco) : null,
        ':cultural_sign'    => !empty($req_cultural) ? trim($req_cultural) : null,
        ':photo'            => !empty($body['photo']) ? $body['photo'] : null,
        ':photo_name'       => !empty($req_photo_name) ? trim($req_photo_name) : null
    ]);

    respond(200, ['status' => 'success', 'message' => 'New species record successfully created.']);
} catch (\PDOException $e) {
    error_log('Database Insert Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database storage failure.']);
}
