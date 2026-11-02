-- IoT plant protection: optional movement distance and device GPS on readings, and alert severity
-- for automatic threat detection. Existing device requests keep working unchanged.
ALTER TABLE sensor_readings
    ADD COLUMN distance_cm DECIMAL(8,2) NULL AFTER soil_moisture_raw_percent,
    ADD COLUMN location_source ENUM('device', 'registered') NOT NULL DEFAULT 'registered' AFTER distance_cm;

ALTER TABLE threat_alerts
    ADD COLUMN severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'warning' AFTER alert_type;
