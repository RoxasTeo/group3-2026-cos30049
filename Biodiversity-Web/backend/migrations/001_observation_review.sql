-- Run once against the existing application database. No sample data is inserted.
CREATE TABLE IF NOT EXISTS observations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    submitted_by INT UNSIGNED NOT NULL,
    client_reference VARCHAR(64) NOT NULL,
    plant_tag VARCHAR(64) NOT NULL,
    species_id INT NULL,
    common_name VARCHAR(120) NOT NULL,
    scientific_name VARCHAR(160) NOT NULL DEFAULT '',
    family VARCHAR(100) NOT NULL DEFAULT '',
    field_notes TEXT NOT NULL,
    habitat TEXT NOT NULL,
    height_m DECIMAL(8,2) NULL,
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    accuracy_m DECIMAL(10,2) NULL,
    location_captured_at DATETIME NULL,
    photos JSON NOT NULL,
    photo_count TINYINT UNSIGNED NOT NULL,
    status ENUM('Pending','Changes requested','Approved','Rejected') NOT NULL DEFAULT 'Pending',
    version INT UNSIGNED NOT NULL DEFAULT 1,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    UNIQUE KEY observation_client_reference (submitted_by, client_reference),
    KEY observation_queue (status, submitted_at, id),
    FOREIGN KEY (submitted_by) REFERENCES users(id),
    FOREIGN KEY (species_id) REFERENCES species(species_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS observation_reviews (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    observation_id INT UNSIGNED NOT NULL,
    reviewer_id INT UNSIGNED NOT NULL,
    decision ENUM('Changes requested','Approved','Rejected') NOT NULL,
    notes TEXT NOT NULL,
    checks JSON NOT NULL,
    observation_version INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY one_review_per_version (observation_id, observation_version),
    FOREIGN KEY (observation_id) REFERENCES observations(id),
    FOREIGN KEY (reviewer_id) REFERENCES users(id)
) ENGINE=InnoDB;
