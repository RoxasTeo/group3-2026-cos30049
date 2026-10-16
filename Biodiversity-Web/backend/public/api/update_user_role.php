<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    respond(403, ['error' => 'Access Denied: Administrative credentials required.']);
}

$body = jsonBody();
$target_user_id = isset($body['user_id']) ? (int)$body['user_id'] : null;
$new_role = isset($body['role']) ? trim($body['role']) : '';

if (!$target_user_id || empty($new_role)) {
    respond(400, ['error' => 'Missing required parameter slots: user_id and role variables are mandatory.']);
}

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

    $sql = "UPDATE users SET role = ? WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$new_role, $target_user_id]);

    respond(200, ['status' => 'success', 'message' => 'User profile role successfully modified inside database registries.']);

} catch (\PDOException $e) {
    error_log('Database User Role Modification Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database data manipulation failure.']);
}
