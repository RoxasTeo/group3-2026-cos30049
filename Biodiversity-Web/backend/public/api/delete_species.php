<?php
require_once __DIR__ . '/../../bootstrap.php';

// Enforce strict HTTP method validation, CORS headers, and initialize the session
api(['POST', 'DELETE']); 

// Enforce anti-forgery handshake security checks using your project's helper
requireCsrf();

// 1. Authenticate Request & Enforce Role Clearances
if (!isset($_SESSION['role']) || !in_array($_SESSION['role'], ['conservation_officer', 'admin'], true)) {
    respond(403, ['error' => 'Access Denied: Insufficient write privileges.']);
}

// 2. Validate Target Parameter ID
$target_id = isset($_GET['id']) ? (int)$_GET['id'] : null;
if (!$target_id) {
    respond(400, ['error' => 'Missing row identifier parameter (?id=).']);
}

// 3. Connect to your pre-configured PDO database instance
$db = database();

try {
    $stmt = $db->prepare("DELETE FROM species WHERE species_id = ?");
    $stmt->execute([$target_id]);
    
    if ($stmt->rowCount() === 0) {
        respond(404, ['error' => 'No record deleted. Target entry was not found.']);
    }
    
    respond(200, ['status' => 'success', 'message' => 'Record successfully cleared from system registries.']);
} catch (\PDOException $e) {
    error_log('Database Delete Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database operation failure.']);
}
