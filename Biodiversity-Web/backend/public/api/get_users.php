<?php
// Load your framework bootstrap utilities, session flags, and core handlers
require_once __DIR__ . '/../../bootstrap.php';

// Enforce strict GET method validation, headers setup, and automated session parsing
api(['GET']);

// 1. Structural Guard Check: Only a verified Admin can access user directories
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    respond(403, ['error' => 'Access Denied: Administrative credentials required.']);
}

// 2. Fetch your global, pre-configured PDO database instance
$db = database();

try {
    // 🟩 SECURE SELECTION: Pulls active data rows while keeping raw password hashes hidden
    $stmt = $db->query("
        SELECT 
            id, 
            name, 
            email, 
            role, 
            is_active 
        FROM users 
        WHERE role != 'admin'
        ORDER BY name ASC
    ");
    
    $usersList = $stmt->fetchAll();
    
    // Stream your active accounts collection array straight out to your Vue frontend component
    respond(200, $usersList);

} catch (\PDOException $e) {
    // Log the true database exception stack trace silently for safety
    error_log('Database User Retrieval Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database operational retrieval failure.']);
}
