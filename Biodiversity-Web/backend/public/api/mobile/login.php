<?php
require_once __DIR__ . '/../../../auth.php';
require_once __DIR__ . '/../../../mobile.php';
api(['POST'], false);

$db = database();
$user = verifyCredentials($db, jsonBody());
// Admins and public users manage their accounts on the Web portal.
if (!in_array($user['role'], MOBILE_ROLES, true)) respond(403, ['error' => 'This account uses the Web portal.']);
respond(200, issueMobileToken($db, $user['id']) + ['user' => $user]);
