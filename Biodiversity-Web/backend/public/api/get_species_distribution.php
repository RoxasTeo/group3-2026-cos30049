<?php
require_once __DIR__ . '/../../observations.php';
api(['GET']);
requireRole(['conservation_officer', 'admin']);

$query = $_GET['q'] ?? '';
$status = $_GET['conservation_status'] ?? '';
$pending = $_GET['include_pending'] ?? '0';
$statuses = ['Not Evaluated', 'Data Deficient', 'Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Extinct in the Wild', 'Extinct'];
if (!is_string($query) || strlen($query) > 200 || !is_string($status) || ($status !== '' && !in_array($status, $statuses, true)) || !in_array($pending, ['0', '1'], true)) {
    respond(400, ['error' => 'Invalid distribution filters.']);
}
$speciesId = isset($_GET['species_id']) ? observationId($_GET['species_id']) : null;
$where = [$pending === '1' ? "o.status IN ('Approved', 'Pending')" : "o.status = 'Approved'"];
$params = [];
if (trim($query) !== '') {
    $like = '%' . strtr(trim($query), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    $where[] = "(COALESCE(s.common_name, o.common_name) LIKE ? ESCAPE '!' OR COALESCE(s.scientific_name, o.scientific_name) LIKE ? ESCAPE '!' OR o.plant_tag LIKE ? ESCAPE '!' OR CONCAT('OBS-', LPAD(o.id, 6, '0')) LIKE ? ESCAPE '!')";
    array_push($params, $like, $like, $like, $like);
}
if ($speciesId !== null) { $where[] = 's.species_id = ?'; $params[] = $speciesId; }
if ($status !== '') { $where[] = 's.status = ?'; $params[] = $status; }
$db = database();
$from = ' FROM observations o LEFT JOIN species s ON s.species_id = o.species_id';
$filter = ' WHERE ' . implode(' AND ', $where);
$validGps = 'o.latitude IS NOT NULL AND o.longitude IS NOT NULL AND o.latitude BETWEEN -90 AND 90 AND o.longitude BETWEEN -180 AND 180';
$stmt = $db->prepare("SELECT COUNT(CASE WHEN s.species_id IS NOT NULL THEN 1 END) AS linked_count,
    COUNT(CASE WHEN s.species_id IS NOT NULL AND ($validGps) THEN 1 END) AS mapped_available,
    COUNT(CASE WHEN s.species_id IS NOT NULL AND NOT ($validGps) THEN 1 END) AS missing_gps,
    COUNT(CASE WHEN s.species_id IS NULL THEN 1 END) AS unlinked_count" . $from . $filter);
$stmt->execute($params);
$summary = array_map('intval', $stmt->fetch());

// Prefer mappable records, then newest first. Never send photo blobs/field notes in the map response.
$limit = 2000;
$sql = 'SELECT o.id, o.submitted_by, o.plant_tag, o.species_id, o.latitude, o.longitude, o.accuracy_m,
    o.location_captured_at, o.submitted_at, o.status AS review_status, u.name AS submitter_name,
    s.common_name, s.scientific_name, s.family, s.status AS conservation_status' . $from .
    ' JOIN users u ON u.id = o.submitted_by' . $filter . " AND s.species_id IS NOT NULL ORDER BY ($validGps) DESC, o.submitted_at DESC, o.id DESC LIMIT $limit";
$stmt = $db->prepare($sql); $stmt->execute($params);
$records = $stmt->fetchAll();
foreach ($records as &$record) {
    foreach (['id', 'submitted_by', 'species_id'] as $key) $record[$key] = (int) $record[$key];
    foreach (['latitude', 'longitude', 'accuracy_m'] as $key) $record[$key] = $record[$key] === null ? null : (float) $record[$key];
    $record['reference'] = 'OBS-' . str_pad((string) $record['id'], 6, '0', STR_PAD_LEFT);
}
unset($record);
$species = $db->query("SELECT DISTINCT s.species_id, s.common_name, s.scientific_name FROM species s JOIN observations o ON o.species_id = s.species_id WHERE o.status IN ('Approved', 'Pending') ORDER BY s.common_name, s.species_id")->fetchAll();
respond(200, ['records' => $records, 'summary' => $summary, 'species' => $species, 'conservation_statuses' => $statuses, 'limit' => $limit, 'truncated' => $summary['linked_count'] > count($records)]);
