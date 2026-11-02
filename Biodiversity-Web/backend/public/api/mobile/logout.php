<?php
require_once __DIR__ . '/../../../mobile.php';
api(['POST'], false);

$hash = bearerTokenHash();
if ($hash !== null) database()->prepare('DELETE FROM mobile_tokens WHERE token_hash = ?')->execute([$hash]);
respond(200, ['status' => 'signed out']);
