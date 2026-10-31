<?php
require_once __DIR__ . '/../../observations.php';
api(['GET']);
requireRole(['conservation_officer', 'admin']);
$status = $_GET['status'] ?? 'Pending';
$query = $_GET['q'] ?? '';
if (!is_string($status) || !in_array($status, [...OBSERVATION_STATUSES, 'All'], true) || !is_string($query) || strlen($query) > 200) respond(400, ['error' => 'Invalid search or status.']);
$page = observationId($_GET['page'] ?? 1);
$submitter = isset($_GET['submitter']) ? observationId($_GET['submitter']) : null;
$where = []; $params = [];
if (trim($query) !== '') {
    $like = '%' . strtr(trim($query), ['!' => '!!', '%' => '!%', '_' => '!_']) . '%';
    $where[] = "(o.common_name LIKE ? ESCAPE '!' OR o.scientific_name LIKE ? ESCAPE '!' OR o.plant_tag LIKE ? ESCAPE '!' OR CONCAT('OBS-', LPAD(o.id, 6, '0')) LIKE ? ESCAPE '!')";
    array_push($params, $like, $like, $like, $like);
}
if ($submitter !== null) { $where[] = 'o.submitted_by = ?'; $params[] = $submitter; }
$db = database();
$baseWhere = $where ? ' WHERE ' . implode(' AND ', $where) : '';
$stmt = $db->prepare('SELECT o.status, COUNT(*) AS count FROM observations o' . $baseWhere . ' GROUP BY o.status');
$stmt->execute($params);
$counts = array_fill_keys(OBSERVATION_STATUSES, 0);
foreach ($stmt->fetchAll() as $row) $counts[$row['status']] = (int) $row['count'];
$counts['All'] = array_sum($counts);
if ($status !== 'All') { $where[] = 'o.status = ?'; $params[] = $status; }
$total = $counts[$status];
$pages = max(1, (int) ceil($total / 20));
$page = min($page, $pages);
$sql = 'SELECT o.id, o.submitted_by, o.plant_tag, o.species_id, o.common_name, o.scientific_name, o.photo_count, o.latitude, o.longitude, o.accuracy_m, o.status, o.version, o.submitted_at, u.name AS submitter_name FROM observations o JOIN users u ON u.id = o.submitted_by' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY o.submitted_at DESC, o.id DESC LIMIT 20 OFFSET ' . (($page - 1) * 20);
$stmt = $db->prepare($sql); $stmt->execute($params);
$rows = array_map('observationSummary', $stmt->fetchAll());
$submitters = $db->query('SELECT DISTINCT u.id, u.name FROM users u JOIN observations o ON o.submitted_by = u.id ORDER BY u.name, u.id')->fetchAll();
respond(200, ['observations' => $rows, 'counts' => $counts, 'submitters' => $submitters, 'total' => $total, 'page' => $page, 'pages' => $pages]);
