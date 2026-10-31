<?php
require_once __DIR__ . '/../threat_detection.php';
function check(bool $condition): void { if (!$condition) throw new RuntimeException('Threat rule assertion failed.'); }
$config = threatConfiguration();
$normal = ['temperature' => 25, 'humidity' => 70, 'distance_cm' => 100];
check(detectThreats($normal, null, $config) === []);
foreach ([['temperature',35,'temperature_high','warning'], ['temperature',40,'temperature_high','critical'], ['temperature',10,'temperature_low','warning'], ['temperature',5,'temperature_low','critical'], ['humidity',30,'humidity_low','warning'], ['humidity',15,'humidity_low','critical'], ['humidity',95,'humidity_high','warning'], ['humidity',99,'humidity_high','critical'], ['distance_cm',50,'proximity','warning'], ['distance_cm',20,'proximity','critical']] as [$key,$value,$rule,$severity]) {
    $alerts = detectThreats([...$normal, $key => $value], null, $config);
    check(count($alerts) === 1 && $alerts[0]['rule'] === $rule && $alerts[0]['severity'] === $severity);
}
foreach ([130 => 'warning', 180 => 'critical'] as $value => $severity) {
    $alerts = detectThreats([...$normal,'distance_cm'=>$value], ['distance_cm'=>100], $config);
    check(count($alerts) === 1 && $alerts[0]['rule'] === 'distance_change' && $alerts[0]['severity'] === $severity);
}
check(count(detectThreats(['temperature'=>40,'humidity'=>99,'distance_cm'=>20], ['distance_cm'=>200], $config)) === 4);
check(detectThreats(['temperature'=>40,'humidity'=>99,'distance_cm'=>20], null, [...$config,'enabled'=>false]) === []);
putenv('THREAT_TEMPERATURE_HIGH_WARNING=invalid');
$rejected=false;try{threatConfiguration();}catch(RuntimeException $error){$rejected=true;}check($rejected);
echo "PASS: normal readings, exact warning/critical boundaries, all four rule types, combined triggers, disabled mode and invalid configuration.\n";
