# Species distribution map

## Delivered and navigation

`/#/distribution` is accessible to Conservation Officers and Admins, and appears in the existing sidebar. Species details link to `/#/distribution?species=<species_id>` through **View on map**. Map and review pages use live API data, not the old global sample-data banner. The Leaflet map code and geographic context are lazy-loaded only when this route opens.

The map offers name/scientific-name/tag/observation-reference search, linked-species and conservation-status filters, pending opt-in, selectable keyboard-accessible markers, selected-record GPS/accuracy evidence, scale/zoom/Fit controls and actual links to observation/species details. Matching records include a no-GPS action and paginate locally in groups of 20. Missing/invalid coordinates are never replaced with fabricated values. Numeric zero is a valid coordinate.

## Source and interpretation

GET `/api/get_species_distribution.php` uses the existing authenticated session and full Officer/Admin server guard. Parameters: optional `q` (200 UTF-8 bytes), positive `species_id`, exact `conservation_status`, and `include_pending=0|1` (default 0).

The query links `observations.species_id` to `species.species_id`. It defaults to Approved observations. Opt-in includes Pending, with visibly hollow markers; Rejected and Changes requested observations never appear. Species names, family and conservation assessments come from the linked knowledge record, not unverified submitted names. Approval remains a field-evidence decision and is not independent taxonomic verification.

Response: `{ records, summary, species, conservation_statuses, limit, truncated }`. Records contain coordinates, accuracy, source timestamps, submitter display name, review status, identifiers and linked species display metadata. No photographs, field notes, email addresses or password data are sent by this endpoint.

`summary` includes `linked_count`, `mapped_available`, `missing_gps` and `unlinked_count` for all matching records. Record payloads are capped at 2000, with valid-GPS records first, newest first within each group. `truncated` and the UI explicitly disclose limits and ask users to refine their filters. Marker/species counts describe the records actually loaded, not unseen records. Dropdown options describe linked Approved/Pending species in the database, independent of current search.

An observation without a linked species is excluded from the species map and counted separately. Records with missing/invalid GPS are retained in the list when within the payload cap and are excluded from markers. Deleting a linked species sets the observation link to null through the review migration's foreign key, rather than leaving a misleading species distribution point. A knowledge record alone has no assumed physical location.

Points represent recorded observations, not species abundance, distinct individual plants, surveyed area, absence elsewhere or a species' complete natural range. Multiple observations may refer to the same plant tag or coordinates; markers may overlap. The list remains an accessible alternative to overlapping markers. Marker colour groups threatened assessments (Vulnerable/Endangered/Critically Endangered), Least Concern and other assessments; review state also uses fill/outline and explicit text.

## Basemap and deployment

Leaflet 1.9.4 is pinned in package.json/package-lock.json. Online context uses `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with attribution and Leaflet's normal browser caching. No tile prefetch, bulk download, export or offline tile cache is implemented. Follow the provider's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and select a suitable provider for deployment traffic. Online tiles require network access and expose the viewed tile area to the provider, not the observation payload. Users can turn Online basemap off.

`src/data/niah-context.json` contains an embedded local vector fallback from OpenStreetMap: roads/paths, rivers and available forest geometry in the Niah area (query bounding box south=3.77, west=113.73, north=3.85, east=113.84; downloaded 2026-10-31 via Overpass API, `out geom`). It is static map context, not park boundary/survey or plant data. Attribution is always displayed. OpenStreetMap data is [ODbL](https://www.openstreetmap.org/copyright); retain attribution and review redistribution obligations when publishing modified geographic data. This context is geographically limited: online tiles are needed for wider geography. A tile-error message offers the local-context mode without hiding observation points.

No production records or sample observations are embedded in this map. No map-specific SQL migration is required: it reads the observation review tables and existing species schema, so deploy the review migration first. Existing unlinked field submissions will not magically appear: the Mobile/submission integrator must provide the correct optional species link and actual GPS. Do not map plant tags directly to numeric species IDs.

## Verification

- `npm run build` passes, with a separate lazy-loaded map chunk.
- `node --test tests/*.test.mjs` passes six frontend policy groups (review plus map).
- `php -l backend/public/api/get_species_distribution.php` passes.
- Against the same disposable local `*_test` database described in OBSERVATION_REVIEW.md, run `python backend/tests/distribution_integration.py` with the existing REVIEW_TEST_* and DB_* test environment. Four real PHP/MySQL groups verify approved/linked eligibility, missing GPS and unlinked counts, pending isolation, current knowledge metadata, combined filters, invalid input/search escaping and Officer/Admin authorization. `seed_distribution.php` creates explicitly fictional species only after checking the opt-in local test environment.
- Live browser checks against real PHP/MySQL cover keyboard markers, pending markers, no-GPS details, combined filtering, species profile/map deep links, empty results, deliberate tile failure/local vector fallback, role denial and 390/768/1440px layouts. Actual online tile availability depends on the network/provider; failure is reported and does not invent geography or observations.

Mobile-to-server synchronisation, automatic species matching, public visitor access and sensitive-location disclosure policies remain separate integration/product decisions. The page is restricted to Officer/Admin, not public visitors. Report/QR/monitoring integrations are not silently merged by this change.
