<?php
require_once __DIR__ . '/../../observations.php';
api(['POST']);
$user = requireRole(['conservation_officer', 'admin']);
requireCsrf();
$body = jsonBody(8192);
$id = observationId($body['id'] ?? null);
$version = observationId($body['version'] ?? null);
$decision = $body['decision'] ?? null;
if (!in_array($decision, ['Approved', 'Changes requested', 'Rejected'], true)) respond(400, ['error' => 'Invalid review decision.']);
$notes = observationText($body, 'notes', 1000, $decision !== 'Approved');
if (function_exists('mb_strlen') && mb_strlen($notes, 'UTF-8') > 1000) respond(400, ['error' => 'Reviewer notes must be at most 1000 characters.']);
$checks = $body['checks'] ?? new stdClass();
if (!$checks instanceof stdClass) respond(400, ['error' => 'Invalid evidence checks.']);
$checks = (array) $checks;
$cleanChecks = [];
foreach (['notes', 'photos', 'gps'] as $key) {
    if (isset($checks[$key]) && !is_bool($checks[$key])) respond(400, ['error' => 'Evidence checks must be booleans.']);
    $cleanChecks[$key] = ($checks[$key] ?? false) === true;
}
if ($decision === 'Approved' && in_array(false, $cleanChecks, true)) respond(400, ['error' => 'Review all three evidence checks before approving.']);
$db = database();
try {
    $db->beginTransaction();
    $stmt = $db->prepare('SELECT status, version, submitted_by FROM observations WHERE id = ? FOR UPDATE');
    $stmt->execute([$id]); $record = $stmt->fetch();
    if (!$record) { $db->rollBack(); respond(404, ['error' => 'Observation not found.']); }
    if ((int) $record['submitted_by'] === (int) $user['id']) { $db->rollBack(); respond(403, ['error' => 'You cannot review your own submission.']); }
    if ($record['status'] !== 'Pending' || (int) $record['version'] !== $version) {
        $db->rollBack(); respond(409, ['error' => 'This observation changed or has already been reviewed. Reload it before continuing.']);
    }
    $stmt = $db->prepare('INSERT INTO observation_reviews (observation_id, reviewer_id, decision, notes, checks, observation_version, created_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
    $stmt->execute([$id, (int) $user['id'], $decision, protectData($notes, reviewNotesContext(['observation_id' => $id, 'observation_version' => $version, 'reviewer_id' => $user['id']])), json_encode($cleanChecks, JSON_THROW_ON_ERROR), $version]);
    $stmt = $db->prepare('UPDATE observations SET status = ?, version = version + 1, reviewed_at = UTC_TIMESTAMP() WHERE id = ?');
    $stmt->execute([$decision, $id]);
    $db->commit();
} catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
respond(200, ['observation' => observationDetail($db, $id)]);
