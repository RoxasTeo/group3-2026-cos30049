# Web monitoring integration

## Current device contract (2026-11-02)

This section supersedes older notes below that describe `plant_id` as a species ID. Apply migrations `006` and `007` to existing databases.

`POST /api/add_sensor_reading.php` with header `X-Device-Key: <IOT_DEVICE_API_KEY>`:

| Field | Required | Meaning |
| --- | --- | --- |
| `plant_id` | yes | `tracked_plants.id` of the protected plant |
| `temperature`, `humidity` | yes | °C (-50 to 100) and % (0 to 100) |
| `soil_moisture_raw`, `soil_moisture_raw_percent` | no | ADC value 0-4095 and 0-100 % |
| `distance_cm` | no | Ultrasonic distance. Enables the proximity rule and movement detection (sudden change from the previous recent reading) |
| `latitude`, `longitude` | no, both or neither | Device GPS fix. Stored with `location_source = device`; otherwise the plant's registered coordinates are used (`registered`) |
| `tracking_assignment_id` | no | Must be an active assignment of this plant |

Every accepted reading runs the server-side rules below inside the same transaction; the response lists any `automatic_alerts` (type, severity, message). Existing payloads without the optional fields keep working. `POST /api/add_threat_alert.php` accepts an optional `severity` (`info`, `warning` default, `critical`) for device-detected events. `POST /api/submit_device_reading.php` is the per-device-key alternative described in `TRACKING.md`; it always reports distance and device GPS.

The Monitoring dashboard shows alert severity, reading distance and whether the location came from device GPS.


The existing database columns remain `sensor_readings.plant_id` and `threat_alerts.plant_id`. They currently reference `species.species_id` in the device ingestion validation, not a mobile plant tag. No column rename or data migration is needed. Both GET endpoints now explicitly select `plant_id AS species_id`, matching the dashboard contract. Reads require the shared live-account officer/admin guard.

Both POST endpoints accept either `plant_id` or `species_id`, preserving existing device payloads. If both are provided they must be the same positive integer. The server still requires the private `X-Device-Key` and a configured `IOT_DEVICE_API_KEY`; no device key is shipped to the browser. The frontend calls only authenticated GET endpoints. Set the private server key when the device team is ready, rather than exposing it in Vite variables.

The dashboard refreshes every 30 seconds while visible. Users can pause automatic refresh or manually refresh. Visibility restoration triggers a refresh when enabled. Requests do not overlap, time out after 15 seconds, and are aborted on unmount. A failed refresh retains the previous successful pair of datasets with a stale-data warning and last-successful-update time. A subsequent successful refresh clears the warning. Search and severity filters are retained.

## Device-team handoff

Agree that the current ID is a species row ID. If hardware needs to track separate individual plants or multiple sensors per plant, that requires an explicit plant/device relationship in a later schema. Configure the device and private API key, verify real payloads persist and appear within the next visible-page refresh, and then test real threat-generation rules separately. No such rules were added by this Web refresh fix.


## Historical ecological analysis

The monitoring page now includes a separate history snapshot: inclusive start/end dates, species filter, quick 7/30/90/365-day ranges, summary count and mean/min/max temperature/humidity, mean distance, metric selector, accessible SVG trend and exact aggregate data table, plus 50-row paginated raw measurements. Empty data stays empty; errors preserve the previous labelled range. Applying new filters resets pagination. Live refresh does not overwrite the historical snapshot.

`GET /api/get_monitoring_history.php?start=YYYY-MM-DD&end=YYYY-MM-DD&species_id=<optional-id>&page=1` requires a live officer/admin session. Dates are interpreted against stored sensor timestamps, including the full end day; existing timestamps carry no timezone metadata, so no UTC-to-local conversion is invented. The device team must agree the recording timezone before hardware integration. UI quick ranges use today's Malaysia date. Ranges up to 3660 days are allowed; up to 366 calendar dates use daily buckets, longer ranges use monthly buckets. Missing buckets are not filled with zero or connected by lines. Means are weighted by individual measurements, not averages of daily means. All-species results pool locations and are labelled accordingly. A repeatable-read transaction keeps summaries, buckets and paginated rows consistent within each response; navigating pages performs a fresh read.

For a new database the schema includes range-query indexes. Existing installations should apply `backend/migrations/002_monitoring_history_indexes.sql` once with a schema operator after checking whether those named indexes already exist. This creates indexes only and does not alter or delete readings.



## Automatic server-side threat detection

Accepted `add_sensor_reading.php` requests now evaluate configurable rules and atomically insert the reading plus any automatic alerts. The response retains `reading_id` and adds `automatic_alerts` containing only newly created alerts. The ID is still a species row ID; one ordered sensor stream per species is assumed until individual plant/device modelling is agreed. No hardware, external notifications, SMS or deployment changes are included.

Initial demonstration thresholds (not field-validated conservation limits): temperature warning at <=10 or >=35 °C, critical at <=5 or >=40 °C; humidity warning at <=30 or >=95%, critical at <=15 or >=99%; proximity warning at <=50 cm, critical at <=20 cm; absolute distance change warning at >=30 cm, critical at >=80 cm compared with the previous reading within 300 seconds. No distance-change alert is inferred from a first reading or a stale baseline. Motion alerts indicate a change in distance, not confirmation of human activity or poaching. Exact boundaries are inclusive. Future readings use new configuration values; existing readings are not automatically backfilled.

Configuration is private server environment, listed in `backend/.env.example`. `THREAT_DETECTION_ENABLED=false` pauses evaluation while continuing to store readings. Invalid/misordered configuration fails without storing a partial reading. All time windows must be 1-86400 whole seconds. The rules endpoint exposes thresholds only to officers/admins; no device key is returned. Thresholds must be calibrated with the device/conservation team before field use.

Each species/rule has a 300-second cooldown. Repeated same/lower severity does not generate another alert in that window; Warning -> Critical is immediate. High/low temperature and humidity have separate rule identities. Recovery does not emit a resolved event; a fresh incident inside the cooldown remains suppressed, and a continuing abnormal condition can generate another alert after the window. Detection is triggered by incoming readings, not a scheduled job. The monitoring UI shows the current thresholds and the existing 30-second polling displays new alerts.

A species-row transaction lock serializes automatic detection for that species, including baseline lookup and cooldown checks. Reading and alert tables must use InnoDB. Automatic alert messages carry an `Automatic [rule]` prefix; deduplication applies only to matching automatic rule messages, not manual/device alert submissions. Agree whether the device or server owns alert generation before integration to avoid separately submitting duplicate manual alerts. Old manually created alerts are retained.

New installations include a lookup index on `(plant_id, alert_type, created_at)`. Existing installations can apply `backend/migrations/003_threat_detection_index.sql` once after checking for that index. This changes no recorded data. Baseline/history indexes are in migration 002.

Verification, 2026-10-31: pure rule tests passed normal values, all threshold boundaries, four rule types, combined conditions, disabled mode and invalid settings. Four real PHP/MySQL groups passed cooldown suppression, severity escalation, cooldown expiry, multiple rules, stale-baseline handling, input/role checks and transactional rollback after an injected alert-write failure (the temporary test trigger was removed). A browser test posted synthetic readings through the real sensor API, verified database-generated alerts and observed a new humidity alert on the next accelerated 30-second refresh; the thresholds panel also rendered correctly. Fictional fixtures were removed. Existing monitoring compatibility tests and Web build passed. No physical sensor validation is claimed.



Individual plant/device association is now implemented separately; see `TRACKING.md`. Its per-device upload contract and assignment-scoped baselines supersede the earlier single-stream-per-species assumption for tracked uploads. Legacy uploads remain species-only.
