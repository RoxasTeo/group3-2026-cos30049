<?php
require_once __DIR__ . '/../../observations.php';
api(['POST', 'DELETE']); 

requireRole(['conservation_officer', 'admin']);
requireCsrf();


$target_id = observationId($_GET['id'] ?? null);

$db = database();
try {
    $stmt = $db->prepare("DELETE FROM species WHERE species_id = ?");
    $stmt->execute([$target_id]);
    
    if ($stmt->rowCount() === 0) {
        respond(404, ['error' => 'No record deleted. Target entry was not found.']);
    }
    
    respond(200, ['status' => 'success', 'message' => 'Record successfully cleared from system registries.']);
} catch (\PDOException $e) {
    if (($e->errorInfo[1] ?? null) === 1451) respond(409, ['error' => 'This species is linked to individual plants. Its tracking history must be retained; edit the species instead.']);
    error_log('Database Delete Error: ' . $e->getMessage());
    respond(500, ['error' => 'Database operation failure.']);
}
