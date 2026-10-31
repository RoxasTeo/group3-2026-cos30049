CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'conservation_officer', 'botanist', 'admin') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Persistent per-account throttling, including nonexistent accounts.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
    account_key CHAR(64) PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    window_started BIGINT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS species (
    species_id INT AUTO_INCREMENT PRIMARY KEY,
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255) NOT NULL,
    family VARCHAR(100) NOT NULL,
    genus VARCHAR(100),
    status ENUM(
        'Not Evaluated', 
        'Data Deficient', 
        'Least Concern', 
        'Near Threatened', 
        'Vulnerable', 
        'Endangered', 
        'Critically Endangered', 
        'Extinct in the Wild', 
        'Extinct'
    ) NOT NULL DEFAULT 'Not Evaluated',
    habitat VARCHAR(200),
    description TEXT NOT NULL,
    ecological_info TEXT,
    cultural_sign TEXT,

    photo MEDIUMTEXT,
    photo_name VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS tracked_plants (
 id INT AUTO_INCREMENT PRIMARY KEY,
 species_id INT NOT NULL,
 plant_tag VARCHAR(64) NOT NULL UNIQUE,
 label VARCHAR(120) NOT NULL,
 latitude DECIMAL(10,7) NULL,
 longitude DECIMAL(10,7) NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 FOREIGN KEY (species_id) REFERENCES species(species_id) ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tracking_devices (
 id INT AUTO_INCREMENT PRIMARY KEY,
 device_code VARCHAR(64) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL,
 key_hash CHAR(64) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 version INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS tracking_assignments (
 id INT AUTO_INCREMENT PRIMARY KEY,
 device_id INT NOT NULL,
 plant_id INT NOT NULL,
 started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TIMESTAMP NULL DEFAULT NULL,
 active_slot TINYINT NULL DEFAULT 1,
 UNIQUE KEY one_active_assignment (device_id, active_slot),
 FOREIGN KEY (device_id) REFERENCES tracking_devices(id) ON DELETE RESTRICT,
 FOREIGN KEY (plant_id) REFERENCES tracked_plants(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sensor_readings (
    reading_id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_assignment_id INT NULL,
    KEY sensor_assignment_time (tracking_assignment_id, recorded_at),
    FOREIGN KEY (tracking_assignment_id) REFERENCES tracking_assignments(id) ON DELETE RESTRICT,
    plant_id INT NOT NULL,
    temperature DECIMAL(5,2) NOT NULL,
    humidity DECIMAL(5,2) NOT NULL,
    distance_cm DECIMAL(8,2) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY sensor_recorded_at (recorded_at),
    KEY sensor_plant_recorded_at (plant_id, recorded_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS threat_alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_assignment_id INT NULL,
    KEY threat_assignment_time (tracking_assignment_id, created_at),
    FOREIGN KEY (tracking_assignment_id) REFERENCES tracking_assignments(id) ON DELETE RESTRICT,
    plant_id INT NOT NULL,
    alert_type VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message VARCHAR(255) NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY threat_plant_type_created (plant_id, alert_type, created_at)
) ENGINE=InnoDB;

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
