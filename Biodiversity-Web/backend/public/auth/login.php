<?php
require_once __DIR__ . '/../../auth.php';
api(['POST']);
requireCsrf();

$user = verifyCredentials(database(), jsonBody());
$now = time();
session_regenerate_id(true);
$_SESSION = ['user_id' => $user['id'], 'role' => $user['role'], 'issued_at' => $now, 'last_seen' => $now];
respond(200, ['user' => $user, 'csrf_token' => csrfToken()]);
