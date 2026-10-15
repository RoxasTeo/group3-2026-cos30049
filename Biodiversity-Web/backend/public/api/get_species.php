<?php
// Load your framework bootstrap utilities, session flags, and core handlers
require_once __DIR__ . '/../../bootstrap.php';

// Enforce strict GET method validation, headers setup, and automated session parsing
api(['GET']);

// 1. Authenticate Request & Enforce Structural Session Role Checks
if (!isset($_SESSION['role'])) {
    respond(404, ['error' => 'Authentication required. Please log in.']);
}

$current_role = $_SESSION['role'];

// Explicitly block Botanists outright from reading records per your custom project requirements
if ($current_role === 'botanist') {
    respond(403, ['error' => 'Access Denied: Botanists are restricted from accessing system utilities.']);
}

// 2. Fetch your global, pre-configured PDO database instance
$db = database();

// Check if the frontend is querying a single detailed record (e.g., ?id=5) or the full registry list
$target_id = isset($_GET['id']) ? (int)$_GET['id'] : null;

try {
    if ($target_id) {
        // CASE A: Fetching a single detailed profile sheet for deep inspection routing
        $stmt = $db->prepare("SELECT * FROM species WHERE species_id = ?");
        $stmt->execute([$target_id]);
        $record = $stmt->fetch();
        
        if (!$record) {
            respond(404, ['error' => 'Target species record does not exist.']);
        }
        
        respond(200, $record);
        
    } else {
        // CASE B: Fetching the entire active list block to fill data grids
        // Arranges them alphabetically by common name for convenient viewing layout arrays
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
    // Log the true database exception stack trace silently for safety
    error_log('Database Retrieval Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database operational retrieval failure.']);
}
