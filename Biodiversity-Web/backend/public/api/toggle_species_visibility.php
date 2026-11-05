<?php
require_once __DIR__ . '/../../bootstrap.php';

api(['POST']);

// Validate CSRF token
requireCsrf();

// Only administrators and conservation officers can manage visibility
$role = $_SESSION['role'] ?? '';

if (!in_array($role, ['admin', 'conservation_officer'], true)) {
    respond(403, [
        'success' => false,
        'message' => 'You do not have permission to change species visibility.'
    ]);
}

// Get logged-in user ID
$approvedBy = $_SESSION['user_id'] ?? null;

if (!$approvedBy) {
    respond(401, [
        'success' => false,
        'message' => 'User authentication required.'
    ]);
}

// Read JSON request body
$data = jsonBody();

$speciesId = $data['species_id'] ?? null;
$isVisible = $data['is_visible'] ?? null;

// Validate species ID
if (
    !filter_var($speciesId, FILTER_VALIDATE_INT) ||
    (int)$speciesId <= 0
) {
    respond(400, [
        'success' => false,
        'message' => 'Invalid species ID.'
    ]);
}

// Validate visibility value
if (!is_bool($isVisible)) {
    respond(400, [
        'success' => false,
        'message' => 'Visibility must be true or false.'
    ]);
}

try {
    $pdo = database();

    // Check whether the species exists
    $checkSpecies = $pdo->prepare(
        'SELECT species_id FROM species WHERE species_id = :species_id'
    );

    $checkSpecies->execute([
        ':species_id' => (int)$speciesId
    ]);

    if (!$checkSpecies->fetch(PDO::FETCH_ASSOC)) {
        respond(404, [
            'success' => false,
            'message' => 'Species not found.'
        ]);
    }

    if ($isVisible) {

        // Make species visible to normal users
        $stmt = $pdo->prepare(
            'INSERT INTO user_visible_species
                (species_id, approved_by)
             VALUES
                (:species_id, :approved_by)
             ON DUPLICATE KEY UPDATE
                approved_by = VALUES(approved_by),
                approved_at = CURRENT_TIMESTAMP'
        );

        $stmt->execute([
            ':species_id' => (int)$speciesId,
            ':approved_by' => (int)$approvedBy
        ]);

        respond(200, [
            'success' => true,
            'is_visible' => true,
            'message' => 'Species is now visible to users.'
        ]);

    } else {

        // Remove species visibility
        $stmt = $pdo->prepare(
            'DELETE FROM user_visible_species
             WHERE species_id = :species_id'
        );

        $stmt->execute([
            ':species_id' => (int)$speciesId
        ]);

        respond(200, [
            'success' => true,
            'is_visible' => false,
            'message' => 'Species is now hidden from users.'
        ]);
    }

} catch (PDOException $e) {

    error_log('Species visibility error: ' . $e->getMessage());

    respond(500, [
        'success' => false,
        'message' => 'Failed to update species visibility.'
    ]);
}