# Integrated biodiversity reports

Integrated from origin/bryan/biodiversity-reports (6ad8d48) into the existing Web worktree containing observation review and species distribution. Its report data helpers and page/print design are retained, with the integration fixes below. Existing map/review routes and navigation are preserved.

## Use

1. Start the normal PHP/MySQL backend and Vue frontend.
2. Sign in as Conservation Officer or Admin, then select Biodiversity reports (/#/reports).
3. Filter by scientific/common name, family and conservation status, then select Generate report.
4. Select Export CSV, or Print / Save as PDF and choose Save as PDF in the browser print dialog. PDF is not a direct server download.

Reports read the real /api/get_biodiversity_report.php endpoint. This dedicated read-only endpoint uses the shared requireRole(['conservation_officer', 'admin']) guard, enforcing current account status, expiry and role server-side. It does not change the old general species endpoint's access policy. No migration or extra report database is needed; the app DB user needs SELECT on species and the existing account lookup permission.

The route is lazily loaded and role-restricted. Sidebar access and focus rechecks respect its metadata. The old global browser-only sample banner is suppressed for Reports, just as for Map/Review. There is no fake fallback data. The report source and exports omit photo blobs.

## Snapshot and export behaviour

Generation and export both recheck the session. Empty/error/loading datasets cannot generate reports, including form submission by Enter. The snapshot has its own filters and timestamp. Changing filters disables export until regeneration; refreshing clears the report and reloads the database. Export uses the generated snapshot. Logout/role loss clears report data and routes to login/access restricted rather than starting a download.

Counts represent species knowledge records, not individual plants, abundance, observations, historical changes or complete geographic range. Threatened counts include Vulnerable, Endangered and Critically Endangered. The report reflects source assessments without independently verifying them. UI generation time is Malaysia time; CSV generation time is UTC; source update timestamps remain source values.

CSV has UTF-8 BOM, filter metadata, totals, status summary and 11 inventory columns including genus, descriptions, ecological information, cultural significance and source update timestamp. Cells are quoted, quotes/newlines preserved, and spreadsheet formula prefixes neutralized. Downloads use a real browser Blob; the success message only claims that a download was requested.

Print/PDF hides navigation/controls, uses A4 landscape, repeats table headers across pages and avoids splitting ordinary rows. Compact spacing prevents a small four-record report from unnecessarily spilling into a second page and removes application background/min-height whitespace. Large inventories naturally span multiple pages. Client-side checks cannot revoke data already rendered/delivered to a user; direct browser printing of it remains possible.

## Validation

- Production build and node --test tests/*.test.mjs pass: all existing map/review/navigation checks plus original report filter/count/CSV checks (9 reported test entries).
- PHP syntax passes for the new endpoint and opt-in fixture helpers.
- Three real PHP/MySQL groups verify Officer/Admin data and exact export fields, anonymous/non-officer denial, and immediate role-change/deactivated-account enforcement. In the disposable setup from OBSERVATION_REVIEW.md, run python backend/tests/reports_integration.py with REVIEW_TEST_* and DB_* configured. seed_reports.php checks local *_test opt-in guards before creating a clearly fictional export fixture.
- Live browser tests against the real database passed all-record/filtered generation, actual CSV download saving, stale-filter export prevention, empty Enter-submit prevention, refresh, responsive widths and no export after logout. Saved CSVs were parsed against API record IDs, BOM, quotes, embedded newlines, Chinese text and formula neutralization.
- The Print button invoked print, and the browser print engine produced a PDF file. Text extraction confirmed all records and landscape orientation; the rendered result was visually reviewed. The four-record fixture fits one page without app chrome. The user's OS print destination still needs interactive selection.

The fixture DB is isolated from the user's database. No sample data/accounts are created by the application itself. Local integration does not imply production deployment, commit or GitHub push.
