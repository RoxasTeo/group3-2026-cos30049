# Observation review handoff

## Delivered

Based on `origin/RoxasTeo/Biodiversity-Web` (`ad9926a`). The Conservation Officer/Admin navigation includes **Observation review** at `/#/observations` and details at `/#/observations/:id`, using the existing green/cream design. List search covers common/scientific name, tag and observation reference; status and submitter filters combine with server pagination (20 per page). There is no demo-data fallback.

Details show submitted information, optional species link, original photographs/captions, GPS/accuracy, submission identity and review history. Photographs open in an accessible native dialog. Approval requires three explicit evidence-review acknowledgements. Request changes and Reject require a reason. Each action has confirmation/cancel and in-flight protection. Notes/checks are protected by an unsaved-navigation warning. Empty, loading, missing-record, API error, access-denied and stale-review states are supported.

The server validates session expiry, account status, current role and CSRF. Only conservation officers/admins may review, and nobody may review their own submission. A transaction locks the observation and checks its version/Pending state before atomically saving the decision and history. Stale or repeated reviews return 409. Submitted evidence is immutable through these endpoints; reviews never modify `species`.

## Database deployment

For an existing database, run `backend/migrations/001_observation_review.sql` once as an operator, after the existing users/species schema. Fresh installations include these tables in `backend/schema.sql`. Use InnoDB. No account or sample observation is seeded by the application or migration.

The application DB user needs SELECT/INSERT on `observations` and `observation_reviews`, UPDATE on `observations`, and existing SELECT access on users/species. No public migration endpoint exists. The audit table has no application update/delete endpoint. Use least-privilege database grants and include these tables in backup/access policies; DB administrators can still alter data, so this is not a tamper-proof audit log.

API timestamps written by this feature are UTC; the UI labels its display as MYT. Image attachments are validated inline JPG/PNG/WebP data (up to four, each 5 MiB), stored in JSON for this first integration. List responses exclude image bodies. This storage is not encryption at rest; database encryption/managed attachment storage remain separate project work. Search/body limits and pagination constrain request size; enforce deployment-level request/rate limits too. For the maximum four 5 MiB attachments, configure sufficient PHP memory (at least 256 MiB recommended) and MySQL max_allowed_packet (at least 32 MiB; 64 MiB recommended), plus proxy request limits above the 29 MiB JSON cap.

## API contract

All requests use the existing PHP session cookie. POST requires `Content-Type: application/json`, the current `X-CSRF-Token`, and the configured same-origin policy.

| Endpoint | Access | Result |
| --- | --- | --- |
| POST `/api/submit_observation.php` | Botanist | 201 `{ observation }`; server assigns submitter/status/timestamps |
| GET `/api/get_observations.php?status=Pending&q=&page=1&submitter=123` | Officer/Admin | `{ observations, counts, submitters, total, page, pages }` |
| GET `/api/get_observation.php?id=123` | Officer/Admin or owning Botanist | `{ observation }`, including photos/history; another Botanist receives 404 |
| POST `/api/review_observation.php` | Officer/Admin, independent reviewer | `{ observation }`; decision/history saved atomically |

Submission example:

```json
{
  "client_reference": "a-stable-client-generated-uuid",
  "plant_tag": "NIAH-TEMP-014",
  "species_id": null,
  "common_name": "Unidentified tree",
  "scientific_name": "",
  "family": "",
  "field_notes": "Opposite leaves; no flowers observed.",
  "habitat": "Shaded forest edge",
  "height_m": 3,
  "latitude": 3.81024,
  "longitude": 113.78062,
  "accuracy_m": 8,
  "location_captured_at": "2026-10-31T02:00:00Z",
  "photos": []
}
```

Photo entries are `{ "data_url": "data:image/png;base64,...", "caption": "Leaf detail", "file_name": "leaf.png" }`. URLs and local `file://` picker URIs are not accepted. Missing photographs/GPS are allowed so officers can review incomplete evidence and request changes; the approval checklist acknowledges this review and is not automated identification or a scientific quality guarantee. Optional numeric fields must be JSON numbers, not strings. Duplicate `(submitted_by, client_reference)` returns 409 rather than creating another record. An optional `species_id` must refer to an existing species and is independent from `plant_tag`.

Review example:

```json
{
  "id": 123,
  "version": 1,
  "decision": "Approved",
  "notes": "Evidence reviewed; identification remains provisional.",
  "checks": { "notes": true, "photos": true, "gps": true }
}
```

Other decisions are exactly `Changes requested` and `Rejected`. Notes max 1000 characters. Invalid input = 400, anonymous/expired/disabled account = 401, insufficient role/CSRF/own review = 403, missing/inaccessible observation = 404, stale/duplicate decision = 409. Unexpected DB faults return generic 500 JSON through the shared bootstrap.

## Mobile integration boundary

The authenticated submission endpoint is available, but Mobile UI authentication, persistent offline storage and Sync are not changed in this branch. A Mobile integrator must authenticate the Botanist, retain its session/CSRF token, map `plantId` to `plant_tag`, convert cached photo files to validated data URLs, and map `location` to numeric coordinates/accuracy. Persist a unique `client_reference` before transfer. Do not mark a record submitted/synced until the API acknowledges it; an uncertain retry should reconcile using the owning-observation response/known server ID rather than silently creating a new reference.

Review status differs from transport status: `Pending` means awaiting officer review, while Mobile `Pending sync` means not uploaded. Field plant IDs are not species knowledge IDs. No automatic species creation/overwrite occurs on approval.

In this first version each observation receives one immutable review decision. The owning Botanist detail endpoint exposes feedback, but automatic notification, Mobile feedback screens and a linked revision/resubmission workflow are not implemented. A revised submission requires a new client reference; it is not automatically linked to the previous one. These are explicit follow-up tasks, not simulated actions.
