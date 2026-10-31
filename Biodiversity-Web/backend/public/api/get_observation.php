<?php
require_once __DIR__ . '/../../observations.php';
api(['GET']);
$user = requireRole(['conservation_officer', 'admin', 'botanist']);
$record = observationDetail(database(), observationId($_GET['id'] ?? null));
if (!$record || ($user['role'] === 'botanist' && (int) $user['id'] !== $record['submitted_by'])) respond(404, ['error' => 'Observation not found.']);
respond(200, ['observation' => $record]);
