<?php
require_once __DIR__ . '/../../observations.php';
api(['POST']);

requireRole(['admin']);
requireCsrf();


$body = jsonBody();
$target_user_id = observationId($body['user_id'] ?? null);
$new_role = observationText($body, 'role', 40, true);

$valid_system_roles = ['admin', 'conservation_officer', 'botanist', 'user'];
if (!in_array($new_role, $valid_system_roles, true)) {
    respond(400, ['error' => 'Invalid system role argument requested.']);
}

$db = database();
try {
    if ($target_user_id === (int)$_SESSION['user_id'] && $new_role !== 'admin') {
        respond(400, ['error' => 'Operation Aborted: System safety configurations prevent 
                       you from removing your own administrative role.']);
    }

    $check = $db->prepare('SELECT id FROM users WHERE id = ?');
    $check->execute([$target_user_id]);
    if (!$check->fetch()) respond(404, ['error' => 'User not found.']);
    $sql = "UPDATE users SET role = ? WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$new_role, $target_user_id]);

    respond(200, ['status' => 'success', 'message' => 'User profile role successfully modified inside database registries.']);

} catch (\PDOException $e) {
    error_log('Database User Role Modification Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database data manipulation failure.']);
}
