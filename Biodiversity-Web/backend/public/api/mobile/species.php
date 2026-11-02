<?php
require_once __DIR__ . '/../../../mobile.php';
api(['GET'], false);
requireMobileUser();

// Text only: the app caches this list for offline identification, so photographs are left out.
$stmt = database()->query('SELECT species_id, common_name, scientific_name, family, genus, status, habitat, description, ecological_info, cultural_sign, updated_at
    FROM species ORDER BY common_name, species_id');
$species = array_map(fn(array $row): array => [
    'id' => (int) $row['species_id'],
    'commonName' => $row['common_name'],
    'scientificName' => $row['scientific_name'],
    'family' => $row['family'],
    'genus' => (string) ($row['genus'] ?? ''),
    'conservationStatus' => $row['status'],
    'habitat' => (string) ($row['habitat'] ?? ''),
    'description' => $row['description'],
    'ecologicalInfo' => (string) ($row['ecological_info'] ?? ''),
    'culturalSignificance' => (string) ($row['cultural_sign'] ?? ''),
    'updatedAt' => utcIso($row['updated_at']),
], $stmt->fetchAll());
respond(200, ['species' => $species]);
