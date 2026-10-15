<?php
// Load your framework bootstrap utilities, session flags, and core handlers
require_once __DIR__ . '/../../bootstrap.php';

// Enforce strict HTTP POST method validation, headers setup, and automated session parsing
api(['POST']);

// Enforce anti-forgery handshake security checks using your project's helper
requireCsrf();

// 1. Structural Guard: Only a verified Admin can mutate user profile parameters
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    respond(403, ['error' => 'Access Denied: Administrative credentials required.']);
}

// 2. Decode the incoming JSON payload parameters cleanly using your system helper
$body = jsonBody();

$target_user_id = isset($body['user_id']) ? (int)$body['user_id'] : null;
$new_role = isset($body['role']) ? trim($body['role']) : '';

// 3. Complete Validation Checks Grid
if (!$target_user_id || empty($new_role)) {
    respond(400, ['error' => 'Missing required parameter slots: user_id and role variables are mandatory.']);
}

// Strict whitelist constraint check to prevent random inputs injection
$valid_system_roles = ['admin', 'conservation_officer', 'botanist', 'user'];
if (!in_array($new_role, $valid_system_roles, true)) {
    respond(400, ['error' => 'Invalid system role argument requested.']);
}

// 4. Connect to your pre-configured PDO database instance
$db = database();

try {
    // 🟩 SAFETY SYSTEM LOCK: Prevents the currently logged-in administrator from accidentally lock out by demoting themselves
    if ($target_user_id === (int)$_SESSION['user_id'] && $new_role !== 'admin') {
        respond(400, ['error' => 'Operation Aborted: System safety configurations prevent you from removing your own administrative role.']);
    }

    // 5. Execute explicit target update query statement string against table columns
    $sql = "UPDATE users SET role = ? WHERE id = ?";
    $stmt = $db->prepare($sql);
    $stmt->execute([$new_role, $target_user_id]);

    respond(200, ['status' => 'success', 'message' => 'User profile role successfully modified inside database registries.']);

} catch (\PDOException $e) {
    // Log the true database exception stack trace silently for safety
    error_log('Database User Role Modification Error: ' . $e->getMessage());
    respond(500, ['error' => 'Internal database data manipulation failure.']);
}
