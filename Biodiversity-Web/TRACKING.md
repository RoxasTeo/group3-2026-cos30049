# Individual plant and sensor tracking

Implemented locally on `eric/web-observation-review`; not deployed or physically connected. The page is `/#/tracking` and is restricted to officers/admins. It follows the existing forest-green/cream palette. Local Niah context works without external tiles; users can optionally enable OSM tiles. Missing locations are not invented.

## Data model and migration

- `species`: taxonomic knowledge record.
- `tracked_plants`: unique plant tag, label, species association and optional registered coordinates. Multiple plants can share a species. Both coordinates or neither are required; zero coordinates are valid. Species association is fixed after registration to keep historical species aggregates consistent; other plant metadata can be edited with version checks.
- `tracking_devices`: unique device code, display name, enabled state, optimistic version and SHA-256 hash of a random 256-bit per-device key. Plain keys are returned once during creation/replacement and never included in read APIs or browser storage.
- `tracking_assignments`: dated device-to-individual-plant association. Each device has at most one current assignment; a plant may have multiple devices. Reassignment ends the previous row and creates a new one. Unassigning retains history.
- Nullable `tracking_assignment_id` on readings/alerts preserves provenance even after reassignment. Old rows retain NULL and are not retroactively attributed to individual plants. Legacy `sensor_readings.plant_id` / `threat_alerts.plant_id` continue to mean species ID for backward compatibility.

For an existing database, back up first and apply `backend/migrations/004_plant_device_tracking.sql` once using a schema operator. It creates the three tracking tables and adds nullable provenance columns/indexes/foreign keys without replacing readings. Do not run it twice. `backend/schema.sql` supports fresh installations and was imported successfully into a temporary database during verification. Earlier migrations 001-003 remain applicable as documented. Only the isolated local test database was changed in this task.

Referenced species cannot be deleted while individual plants exist; the API returns a clear 409 instead of deleting tracking history. There is no hard-delete action for tracked plants/devices. Disable devices or end assignments to retain evidence.

## Web operations and map

Register/edit plants and devices, assign/reassign/unassign devices, pause uploads and replace keys. Writes require a current officer/admin account, CSRF token and matching version when editing. Concurrent changes return 409. Device keys are not silently reissued on normal edits. Replacing a key invalidates the old one immediately; keys should be transferred privately to the device team.

The map distinguishes registered plant coordinates from the latest received device GPS. Device states are Recent (receipt within 120 seconds), Stale, Awaiting data, Unassigned or Paused. These are report-recency states, not a network connectivity test. The selected device shows up to 100 GPS points from its current assignment in receipt order and up to 100 assignment-history entries. The trail indicates received positions, not a continuous path or proof that a plant moved. Old assignment positions are not shown as the new plant's position. Tracking refreshes every 30 seconds while visible and supports manual refresh, search, status filtering and fit-to-locations. Management lists explicitly cap at 1,000 records with a warning; larger inventories need server-side paging.

## Device API prepared for later integration

`POST /api/submit_device_reading.php` uses the device's own private key in `X-Device-Key` and JSON:

```
{"device_code":"SENSOR-001","temperature":25,"humidity":70,"distance_cm":100,"latitude":3.81,"longitude":113.78}
```

Use JSON numbers. Do not send a plant/species ID: the server resolves the current assignment. A disabled device, unknown code or wrong/replaced key returns 401; no current assignment returns 409. GPS and numeric ranges are validated. Timestamps are server receipt times; no device timestamp/timezone is inferred. Server clocks and device sampling conventions need agreement during hardware integration.

The reading and automatic alerts are written atomically under the device/assignment lock. Distance-change baselines and cooldowns are scoped to the specific assignment; devices of the same species cannot share a baseline or suppress each other's alerts. Reassignment begins a fresh baseline. Monitoring readings/alerts include plant tag and device code, while existing species-level history/reports remain species aggregates. Legacy `add_sensor_reading.php` remains a separate species-only API using the existing shared key; its baseline/alerts are isolated from tracked streams. The legacy path cannot populate individual-device positions. Prefer the new per-device contract for the forthcoming device integration.

## Verification

Real PHP/MySQL tests passed registration, updates, duplicate/stale-version/CSRF rejection, zero and invalid GPS, independent devices with the same species, per-device credentials, pause, rotation, spoofed IDs, assignment replacement and history, no inherited position/baseline, unassignment, role denial and protected species deletion. Browser tests passed actual forms, one-time-key display, assignment, keyed synthetic uploads, real map markers/trail/history, edit/pause/unassign and 390px layout. The tracking suite has four real-database test groups. Shared database regressions and six Web acceptance groups passed; build and nine existing helper tests also passed. Temporary fixtures were removed.

Reproduce with the standard disposable review test environment: `python backend/tests/tracking_integration.py`. Supply Playwright tooling, `REVIEW_TEST_FIXTURES=1`, `REVIEW_TEST_WEB_URL=http://localhost:<web-port>`, `REVIEW_TEST_PHP` and disposable DB variables, then run `node tests/tracking.acceptance.cjs` from `Biodiversity-Website`. No physical device, production data or deployment was used.
