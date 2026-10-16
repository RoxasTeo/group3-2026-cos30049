<?php
require_once __DIR__ . '/../../bootstrap.php';
api(['POST']);
requireCsrf();

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    respond(403, ['error' => 'Access Denied: Administrative credentials required.']);
}

$body = jsonBody();
$target_user_id = isset($body['user_id']) ? (int)$body['user_id'] : null;

if (!$target_user_id) {
    respond(400, ['error' => 'Missing required parameter slots: user_id is mandatory.']);
}

$db = database();
try {
    $stmt = $db->prepare("SELECT role, is_active FROM users WHERE id = ?");
    $stmt->execute([$target_user_id]);
    $target_record = $stmt->fetch();

    if (!$target_record) {
        respond(404, ['error' => 'The requested account record row was not found.']);
    }

    if ($target_record['role'] === 'admin') {
        respond(400, ['error' => 'Security Violation: Administrative profiles cannot be modified or suspended.']);
    }

    $next_state = ((int)$target_record['is_active'] === 1) ? 0 : 1;
    $stmt = $db->prepare("UPDATE users SET is_active = ? WHERE id = ?");
    $stmt->execute([$next_state, $target_user_id]);
    $msg = $next_state === 1 ? 'User profile has been successfully re-activated.' : 'User profile has been successfully deactivated and suspended.';
    respond(200, ['status' => 'success', 'message' => $msg]);

} catch (\PDOException $e) {
    error_log('Database User Toggle Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database data manipulation failure.']);
}
