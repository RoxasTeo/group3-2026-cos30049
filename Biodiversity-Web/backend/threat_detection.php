<?php
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

function threatConfiguration(): array {
    $defaults = ['temperature_low_critical' => 5, 'temperature_low_warning' => 10, 'temperature_high_warning' => 35, 'temperature_high_critical' => 40, 'humidity_low_critical' => 15, 'humidity_low_warning' => 30, 'humidity_high_warning' => 95, 'humidity_high_critical' => 99, 'proximity_critical_cm' => 20, 'proximity_warning_cm' => 50, 'distance_change_warning_cm' => 30, 'distance_change_critical_cm' => 80, 'baseline_max_age_seconds' => 300, 'cooldown_seconds' => 300];
    $enabled = setting('THREAT_DETECTION_ENABLED', 'true');
    if (!in_array($enabled, ['true', 'false'], true)) throw new RuntimeException('THREAT_DETECTION_ENABLED must be true or false.');
    $config = ['enabled' => $enabled === 'true'];
    foreach ($defaults as $key => $default) {
        $value = filter_var(setting('THREAT_' . strtoupper($key), (string) $default), FILTER_VALIDATE_FLOAT);
        if ($value === false || !is_finite($value)) throw new RuntimeException('Invalid threat configuration: ' . $key);
        $config[$key] = (float) $value;
    }
    foreach (['temperature', 'humidity'] as $metric) {
        if (!($config[$metric . '_low_critical'] < $config[$metric . '_low_warning'] && $config[$metric . '_low_warning'] < $config[$metric . '_high_warning'] && $config[$metric . '_high_warning'] < $config[$metric . '_high_critical'])) throw new RuntimeException('Threat thresholds must be ordered.');
    }
    if ($config['humidity_low_critical'] < 0 || $config['humidity_high_critical'] > 100 || $config['proximity_critical_cm'] < 0 || $config['proximity_warning_cm'] <= $config['proximity_critical_cm'] || $config['distance_change_warning_cm'] <= 0 || $config['distance_change_critical_cm'] <= $config['distance_change_warning_cm']) throw new RuntimeException('Invalid humidity or distance thresholds.');
    foreach (['baseline_max_age_seconds', 'cooldown_seconds'] as $key) {
        if ($config[$key] < 1 || $config[$key] > 86400 || floor($config[$key]) !== $config[$key]) throw new RuntimeException('Threat time windows must be whole seconds between 1 and 86400.');
    }
    return $config;
}

function detectThreats(array $reading, ?array $previous, array $config): array {
    if (!$config['enabled']) return [];
    $alerts = [];
    $add = function (string $rule, string $type, string $severity, string $detail) use (&$alerts): void {
        $alerts[] = ['rule' => $rule, 'alert_type' => $type, 'severity' => $severity, 'message' => "Automatic [$rule]: $detail"];
    };
    foreach (['temperature' => '°C', 'humidity' => '%'] as $metric => $unit) {
        $value = $reading[$metric];
        if ($value <= $config[$metric . '_low_warning']) $add($metric . '_low', $metric, $value <= $config[$metric . '_low_critical'] ? 'critical' : 'warning', "$metric $value $unit below configured range.");
        elseif ($value >= $config[$metric . '_high_warning']) $add($metric . '_high', $metric, $value >= $config[$metric . '_high_critical'] ? 'critical' : 'warning', "$metric $value $unit above configured range.");
    }
    // Distance is optional: devices without an ultrasonic sensor skip proximity and movement rules.
    if ($reading['distance_cm'] === null) return $alerts;
    if ($reading['distance_cm'] <= $config['proximity_warning_cm']) $add('proximity', 'proximity', $reading['distance_cm'] <= $config['proximity_critical_cm'] ? 'critical' : 'warning', 'Distance ' . $reading['distance_cm'] . ' cm within configured proximity threshold.');
    if ($previous !== null && $previous['distance_cm'] !== null) {
        $delta = abs($reading['distance_cm'] - (float) $previous['distance_cm']);
        if ($delta >= $config['distance_change_warning_cm']) $add('distance_change', 'motion', $delta >= $config['distance_change_critical_cm'] ? 'critical' : 'warning', "Distance changed by $delta cm since the previous recent reading; inspect sensor and surroundings.");
    }
    return $alerts;
}

// Caller runs this inside the reading transaction. $plantId is the tracked plant (tracked_plants.id).
function storeAutomaticThreats(PDO $db, int $plantId, array $reading, array $alerts, array $config, ?int $assignmentId = null): array {
    $created = [];
    foreach ($alerts as $alert) {
        $severities = $alert['severity'] === 'critical' ? "('critical')" : "('warning','critical')";
        $stmt = $db->prepare("SELECT alert_id FROM threat_alerts WHERE plant_id = ? AND tracking_assignment_id <=> ? AND alert_type = ? AND severity IN $severities AND message LIKE ? AND created_at > DATE_SUB(NOW(), INTERVAL " . (int) $config['cooldown_seconds'] . ' SECOND) LIMIT 1');
        $stmt->execute([$plantId, $assignmentId, $alert['alert_type'], 'Automatic [' . $alert['rule'] . ']:%']);
        if ($stmt->fetch()) continue;
        $stmt = $db->prepare('INSERT INTO threat_alerts (plant_id, tracking_assignment_id, alert_type, severity, message, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$plantId, $assignmentId, $alert['alert_type'], $alert['severity'], $alert['message'], $reading['latitude'], $reading['longitude']]);
        $created[] = ['alert_id' => (int) $db->lastInsertId(), ...$alert];
    }
    return $created;
}
