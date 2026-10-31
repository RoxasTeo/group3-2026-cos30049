-- Apply once to the selected existing database. No data is changed.
CREATE INDEX sensor_recorded_at ON sensor_readings (recorded_at);
CREATE INDEX sensor_plant_recorded_at ON sensor_readings (plant_id, recorded_at);
