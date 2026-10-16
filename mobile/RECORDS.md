# Mobile Records handoff

## Scope

This branch extends the existing `hadif/qr-scanner` Expo application. Records manages collected observations; Sync owns actual transfer to the server. Home, Scan and profile ownership remains with their existing contributors. No native module or new dependency was added.

Entry points:

- `/navigation/botanist/records`: list/search/status filters.
- `/plant/new`: creates a new draft with a unique temporary ID.
- `/plant/new?plantId=NIAH-TEMP-004&edit=true`: continue the sample draft.
- `/plant/NIAH-PLANT-001`: existing QR lookup and record details.

Routes remain in `src/app`; screen implementations remain in `src/screens`.

## Behavior and validation

Draft saves require a valid, immutable plant ID. Empty common names display `Unidentified plant`. Scientific names are optional. Duplicate IDs are rejected instead of silently replacing another record. Missing edit targets are not recreated. The form uses a navigation-removal guard and a browser reload warning to protect unsaved edits.

Only Draft records may be edited or deleted. A separate confirmation is required to delete. Records in Pending sync, Synced or Failed remain read-only in this first version. The repository enforces this even if the edit route is opened directly.

Mark ready validates the plant ID, nonempty field observations and valid latitude/longitude. This provisional rule needs team confirmation, particularly for areas without a GPS fix. Identification and photos are not required. No coordinates are invented to satisfy validation. The seeded draft already has an explicitly illustrative location, allowing the ready workflow to be demonstrated after adding notes. Newly created drafts have no location; save them as drafts until the capture integration is available.

Only the transition `Draft -> Pending sync` is implemented. There is no action that pretends to upload or sets Synced/Failed. Existing Synced/Failed entries are labelled sample records, not evidence of a working transfer. The UI does not expose real cloud data and role URLs are still navigation previews, not authentication.

## Shared repository contract

`src/data/plantRecords.ts` currently holds one in-memory snapshot. `usePlantRecords()` subscribes through React's external-store hook, so list and detail screens refresh when a record changes.

| API | Purpose |
| --- | --- |
| `getPlantRecord(id)` | Normalized QR/plant ID lookup, returns an isolated copy |
| `getRecordsSnapshot()` / `subscribePlantRecords(listener)` | Read and subscribe to the current session snapshot |
| `selectPlantRecords(records, search, filter)` | Name/ID search, combined status filtering and newest-update-first sorting |
| `createTemporaryPlantId()` | Assign a unique ID before saving an unidentified record |
| `savePlantRecord(input, ready?, mode?)` | Create or edit a Draft; optionally validate and mark Pending sync |
| `deletePlantDraft(id)` | Reject non-Drafts; remove a Draft and notify subscribers |
| `readinessIssues(record)` | Return field/GPS validation issues without changing records |

The existing form and detail filenames/routes are retained. QR manual entry continues to open a shared record or prefill a form for an unknown valid ID. The plant ID must remain stable once created, because it also identifies the QR record.

Fields include `plantId`, names, family, conservation status, description, habitat notes, status, creation/update timestamps, photos, location and `sample`. Photos accept a future local URI or a sample-placeholder label. Location includes latitude/longitude, optional accuracy and an explicit sample marker.

## Integration with Ivan / mobile backend

1. Agree on observation fields, user ownership and IDs before adapting the SQLite notes prototype. An observation with GPS/photos is not automatically identical to the web species knowledge record.
2. Replace the in-memory adapter with persistent create/read/update/delete operations. Persist data before publishing a success snapshot; handle errors and migrations. Avoid shipping sample records as real collected data.
3. Photo capture must store a durable local reference and preserve it across app restart. GPS capture must record the actual fix/accuracy and handle denied permissions and unavailable fixes.
4. Transfer Pending records from Sync, mark Synced only after server acknowledgement, retain Failed records and failure details for retry. Agree on idempotency and conflict behavior.
5. The authenticated owner and backend authorization must replace URL-role previews before working with actual field data.

## Validation

From `mobile`: run `npx tsc --noEmit`, `npm run lint` and `npm run test:records`. Seven repository tests cover normalized search/IDs, combined filters/sorting, incomplete saves, collision protection, invalid readiness without mutation, read-only states, deletion, subscriber updates, defensive copies and temporary ID uniqueness.

Expo browser checks passed for list/search/filter, read-only details, new drafts, missing-GPS/notes validation, Draft-to-Pending without a scientific name, deletion confirmation/cancellation, reactive list updates, unsaved-change cancellation/discard, empty-search reset, widths 320/390/480px, and the existing QR lookup. Physical Android/iOS behavior (keyboard, hardware back, camera and GPS) still requires device validation.
