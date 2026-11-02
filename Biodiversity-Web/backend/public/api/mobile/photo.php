<?php
require_once __DIR__ . '/../../../mobile.php';
api(['GET'], false);
$user = requireMobileUser();

$tag = strtoupper(is_string($_GET['plantId'] ?? null) ? $_GET['plantId'] : '');
$index = filter_var($_GET['index'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 3]]);
if (!preg_match('/^[A-Z0-9][A-Z0-9_-]{2,63}$/D', $tag) || $index === false) respond(400, ['error' => 'Invalid photograph request.']);

// Owner-scoped like the record list, so plant IDs cannot be guessed to read other accounts' photos.
$stmt = database()->prepare("SELECT JSON_UNQUOTE(JSON_EXTRACT(photos, CONCAT('$[', ?, '].data_url'))) FROM observations WHERE submitted_by = ? AND client_reference = ?");
$stmt->execute([$index, $user['id'], $tag]);
$uri = $stmt->fetchColumn();
if (!is_string($uri) || !preg_match('~^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$~D', $uri, $match)) respond(404, ['error' => 'Photograph not found.']);
header('Content-Type: ' . $match[1]);
header('Cache-Control: private, max-age=86400');
echo base64_decode($match[2]);
