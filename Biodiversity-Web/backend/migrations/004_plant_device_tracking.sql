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
ALTER TABLE sensor_readings ADD COLUMN tracking_assignment_id INT NULL,
 ADD KEY sensor_assignment_time (tracking_assignment_id, recorded_at),
 ADD CONSTRAINT sensor_tracking_assignment FOREIGN KEY (tracking_assignment_id) REFERENCES tracking_assignments(id) ON DELETE RESTRICT;
ALTER TABLE threat_alerts ADD COLUMN tracking_assignment_id INT NULL,
 ADD KEY threat_assignment_time (tracking_assignment_id, created_at),
 ADD CONSTRAINT threat_tracking_assignment FOREIGN KEY (tracking_assignment_id) REFERENCES tracking_assignments(id) ON DELETE RESTRICT;
