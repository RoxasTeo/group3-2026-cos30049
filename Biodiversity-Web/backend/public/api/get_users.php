<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['GET']);

requireRole(['admin']);

$db = database();
try {
    $stmt = $db->query("
        SELECT 
            id, 
            name, 
            email, 
            role, 
            is_active 
        FROM users 
        WHERE role != 'admin'
    ");
    
    // Names are encrypted, so sort after decryption.
    $usersList = array_map('revealUser', $stmt->fetchAll());
    usort($usersList, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    respond(200, $usersList);

} catch (\PDOException $e) {
    error_log('Database User Retrieval Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database operational retrieval failure.']);
}
