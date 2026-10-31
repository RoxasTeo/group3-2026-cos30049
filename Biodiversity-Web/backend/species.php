<?php
declare(strict_types=1);
require_once __DIR__ . '/observations.php';

function speciesInput(array $body): array {
    foreach (['commonName' => 'common_name', 'scientificName' => 'scientific_name', 'ecologicalNotes' => 'ecological_info', 'culturalNotes' => 'cultural_sign', 'photoName' => 'photo_name'] as $alias => $key) {
        if (!array_key_exists($key, $body) && array_key_exists($alias, $body)) $body[$key] = $body[$alias];
    }
    $clean = [];
    foreach (['common_name' => 255, 'scientific_name' => 255, 'family' => 100, 'genus' => 100, 'habitat' => 200, 'description' => 10000, 'ecological_info' => 10000, 'cultural_sign' => 10000, 'photo_name' => 255] as $key => $max) {
        $clean[$key] = observationText($body, $key, $max, in_array($key, ['common_name', 'scientific_name', 'family', 'description'], true));
    }
    $clean['status'] = observationText($body, 'status', 40) ?: 'Not Evaluated';
    if (!in_array($clean['status'], ['Not Evaluated', 'Data Deficient', 'Least Concern', 'Near Threatened', 'Vulnerable', 'Endangered', 'Critically Endangered', 'Extinct in the Wild', 'Extinct'], true)) respond(400, ['error' => 'Invalid conservation status.']);
    $photo = $body['photo'] ?? '';
    if (!is_string($photo)) respond(400, ['error' => 'Invalid photograph.']);
    if ($photo !== '') {
        $photos = observationPhotos([(object) ['data_url' => $photo]]);
        if (strlen(base64_decode(explode(',', $photo, 2)[1], true)) > 1024 * 1024) respond(400, ['error' => 'Photographs must be no larger than 1 MB.']);
    }
    $clean['photo'] = $photo === '' ? null : $photo;
    if ($photo === '') $clean['photo_name'] = '';
    return $clean;
}
