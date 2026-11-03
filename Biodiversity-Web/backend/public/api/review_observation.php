
<?php

require_once __DIR__ . '/../../observations.php';

api(['POST']);

$user = requireRole(['conservation_officer', 'admin']);
requireCsrf();

$body = jsonBody(8192);

$id = observationId($body['id'] ?? null);
$version = observationId($body['version'] ?? null);
$decision = $body['decision'] ?? null;

if (!in_array($decision, ['Approved', 'Changes requested', 'Rejected'], true)) {
    respond(400, ['error' => 'Invalid review decision.']);
}

$notes = observationText($body, 'notes', 1000, $decision !== 'Approved');

if (function_exists('mb_strlen') && mb_strlen($notes, 'UTF-8') > 1000) {
    respond(400, ['error' => 'Reviewer notes must be at most 1000 characters.']);
}

$checks = $body['checks'] ?? new stdClass();

if (!$checks instanceof stdClass) {
    respond(400, ['error' => 'Invalid evidence checks.']);
}

$checks = (array) $checks;
$cleanChecks = [];

foreach (['notes', 'photos', 'gps'] as $key) {

    if (isset($checks[$key]) && !is_bool($checks[$key])) {
        respond(400, ['error' => 'Evidence checks must be booleans.']);
    }

    $cleanChecks[$key] = ($checks[$key] ?? false) === true;
}

if ($decision === 'Approved' && in_array(false, $cleanChecks, true)) {
    respond(400, ['error' => 'Review all three evidence checks before approving.']);
}

$db = database();

try {

    $db->beginTransaction();

    // 1. Retrieve and lock the observation
    $stmt = $db->prepare(
        'SELECT *
         FROM observations
         WHERE id = ?
         FOR UPDATE'
    );

    $stmt->execute([$id]);
    $record = $stmt->fetch();

    if (!$record) {
        $db->rollBack();
        respond(404, ['error' => 'Observation not found.']);
    }

    // 2. Prevent users from reviewing their own submissions
    if ((int) $record['submitted_by'] === (int) $user['id']) {
        $db->rollBack();
        respond(403, ['error' => 'You cannot review your own submission.']);
    }

    // 3. Check observation status and version
    if (
        $record['status'] !== 'Pending' ||
        (int) $record['version'] !== $version
    ) {
        $db->rollBack();
        respond(409, [
            'error' => 'This observation changed or has already been reviewed. Reload it before continuing.'
        ]);
    }

    // 4. Insert observation review history
    $stmt = $db->prepare(
        'INSERT INTO observation_reviews
        (
            observation_id,
            reviewer_id,
            decision,
            notes,
            checks,
            observation_version,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())'
    );

    $stmt->execute([
        $id,
        (int) $user['id'],
        $decision,
        protectData(
            $notes,
            reviewNotesContext([
                'observation_id' => $id,
                'observation_version' => $version,
                'reviewer_id' => $user['id']
            ])
        ),
        json_encode($cleanChecks, JSON_THROW_ON_ERROR),
        $version
    ]);

    // 5. Register or link species when approved
    $speciesId = $record['species_id'];

    if ($decision === 'Approved' && empty($speciesId)) {

        $scientificName = trim($record['scientific_name'] ?? '');

        // Only search for an existing species if scientific name is provided
        if ($scientificName !== '') {

            $stmt = $db->prepare(
                'SELECT species_id
                 FROM species
                 WHERE scientific_name = ?
                 ORDER BY species_id
                 LIMIT 1'
            );

            $stmt->execute([$scientificName]);
            $existingSpecies = $stmt->fetch();

            if ($existingSpecies) {

                // Link to existing species without modifying it
                $speciesId = $existingSpecies['species_id'];

            } else {

                // Validate conservation status
                $validStatuses = [
                    'Not Evaluated',
                    'Data Deficient',
                    'Least Concern',
                    'Near Threatened',
                    'Vulnerable',
                    'Endangered',
                    'Critically Endangered',
                    'Extinct in the Wild',
                    'Extinct'
                ];

                $speciesStatus = in_array(
                    $record['conservation_status'],
                    $validStatuses,
                    true
                )
                    ? $record['conservation_status']
                    : 'Not Evaluated';

                // 6. Get first observation photo
                $speciesPhoto = null;
                $speciesPhotoName = null;

                $photos = json_decode(
                    $record['photos'] ?? '[]',
                    true
                );

                if (is_array($photos)) {

                    foreach ($photos as $photo) {

                        $photoData = null;
                        $photoName = null;

                        if (is_string($photo)) {

                            // Base64 data URL
                            if (preg_match(
                                '/^data:image\/[a-zA-Z0-9.+-]+;base64,/',
                                $photo
                            )) {
                                $photoData = $photo;
                            } else {
                                // File path or URL
                                $photoData = $photo;
                                $photoName = basename(
                                    parse_url($photo, PHP_URL_PATH) ?? $photo
                                );
                            }

                        } elseif (is_array($photo)) {

                            $photoName = $photo['name'] ?? null;

                            if (!empty($photo['data'])) {
                                $photoData = $photo['data'];
                            } elseif (!empty($photo['url'])) {
                                $photoData = $photo['url'];
                            } elseif (!empty($photo['path'])) {
                                $photoData = $photo['path'];
                            }
                        }

                        if (!empty($photoData)) {
                            $speciesPhoto = $photoData;
                            $speciesPhotoName = $photoName;
                            break;
                        }
                    }
                }

                // 7. Insert new species
                // Habitat, genus, ecological_info and cultural_sign
                // are intentionally NULL.
                $stmt = $db->prepare(
                    'INSERT INTO species
                    (
                        common_name,
                        scientific_name,
                        family,
                        genus,
                        status,
                        habitat,
                        description,
                        ecological_info,
                        cultural_sign,
                        photo,
                        photo_name
                    )
                    VALUES (?, ?, ?, NULL, ?, NULL, ?, NULL, NULL, ?, ?)'
                );

                $stmt->execute([
                    $record['common_name'],
                    $scientificName,
                    $record['family'],
                    $speciesStatus,
                    $record['morphology'] ?? '',
                    $speciesPhoto,
                    $speciesPhotoName
                ]);

                // Get newly created species ID
                $speciesId = $db->lastInsertId();
            }
        }
    }

    // 8. Update observation status and species link
    $stmt = $db->prepare(
        'UPDATE observations
         SET status = ?,
             species_id = ?,
             version = version + 1,
             reviewed_at = UTC_TIMESTAMP()
         WHERE id = ?'
    );

    $stmt->execute([
        $decision,
        $speciesId,
        $id
    ]);

    // 9. Commit all changes
    $db->commit();

} catch (Throwable $e) {

    if ($db->inTransaction()) {
        $db->rollBack();
    }

    throw $e;
}

// 10. Return updated observation
respond(200, [
    'observation' => observationDetail($db, $id)
]);
