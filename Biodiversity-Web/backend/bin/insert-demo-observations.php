<?php
declare(strict_types=1);

require_once __DIR__ . '/../observations.php';

$db = database();

$submittedBy = 3;

$plants = [
    [
        'tag' => 'NIAH-OBS-001',
        'name' => 'Pitcher Plant',
        'scientific' => 'Nepenthes ampullaria',
        'family' => 'Nepenthaceae',
        'notes' => 'Small pitcher plant observed near the forest floor.',
        'habitat' => 'Tropical rainforest',
        'lat' => 1.5350845,
        'lng' => 110.3466346
    ],
    [
        'tag' => 'NIAH-OBS-002',
        'name' => 'Birds Nest Fern',
        'scientific' => 'Asplenium nidus',
        'family' => 'Aspleniaceae',
        'notes' => 'Fern observed growing on a tree trunk.',
        'habitat' => 'Humid rainforest',
        'lat' => 1.5351845,
        'lng' => 110.3467346
    ],
    [
        'tag' => 'NIAH-OBS-003',
        'name' => 'Fan Palm',
        'scientific' => 'Licuala spinosa',
        'family' => 'Arecaceae',
        'notes' => 'Palm observed near a shaded forest area.',
        'habitat' => 'Tropical rainforest',
        'lat' => 1.5352845,
        'lng' => 110.3468346
    ],
    [
        'tag' => 'NIAH-OBS-004',
        'name' => 'Fig Plant',
        'scientific' => 'Ficus deltoidea',
        'family' => 'Moraceae',
        'notes' => 'Small plant observed in a forest clearing.',
        'habitat' => 'Lowland rainforest',
        'lat' => 1.5353845,
        'lng' => 110.3469346
    ],
    [
        'tag' => 'NIAH-OBS-005',
        'name' => 'Tropical Tree',
        'scientific' => 'Shorea parvifolia',
        'family' => 'Dipterocarpaceae',
        'notes' => 'Young tree observed within the forest.',
        'habitat' => 'Tropical lowland rainforest',
        'lat' => 1.5354845,
        'lng' => 110.3470346
    ]
];

$db->beginTransaction();

try {
    $sql = "INSERT INTO observations (
        submitted_by, client_reference, plant_tag,
        species_id, common_name, scientific_name, family,
        field_notes, habitat, morphology,
        conservation_status, latitude, longitude,
        accuracy_m, location_captured_at,
        photos, photo_count, status
    ) VALUES (
        ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL,
        'Not Evaluated', ?, ?, 5.00, NOW(),
        '[]', 0, 'Pending'
    )";

    $stmt = $db->prepare($sql);

    foreach ($plants as $index => $plant) {
        $reference = 'DEMO-OBS-' . str_pad(
            (string) ($index + 1), 3, '0', STR_PAD_LEFT
        );

        $row = [
            'submitted_by' => $submittedBy,
            'client_reference' => $reference
        ];

        $encryptedNotes = protectData(
            $plant['notes'],
            observationSecretContext($row, 'field_notes')
        );

        $encryptedHabitat = protectData(
            $plant['habitat'],
            observationSecretContext($row, 'habitat')
        );

        $stmt->execute([
            $submittedBy,
            $reference,
            $plant['tag'],
            $plant['name'],
            $plant['scientific'],
            $plant['family'],
            $encryptedNotes,
            $encryptedHabitat,
            $plant['lat'],
            $plant['lng']
        ]);
    }

    $db->commit();

    echo "Successfully inserted 5 encrypted demo observations.";

} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
