# Biodiversity reports

The conservation officer/admin Reports page is available at /#/reports. It reads the existing /api/get_species.php endpoint through the shared authenticated request helper. No extra report server or dependency is required.

## Using the feature

1. Start the PHP backend and database using the team's backend README, then start the Vue development server.
2. Sign in as conservation_officer or admin and open Biodiversity reports.
3. Optionally filter by common/scientific name, family and conservation status.
4. Select Generate report to create a snapshot with counts, status summary and inventory.
5. Export CSV, or select Print / Save as PDF and choose Save as PDF in the browser print dialog.

Changing filters disables export until the report is regenerated. Refresh data clears the preview and reloads the API. Empty results and API errors cannot generate a report.

## Report meaning

Counts describe species records, not individual plants, abundance, field observations or historical change. Threatened counts include Vulnerable, Endangered and Critically Endangered. The report reflects database status values and does not independently verify them. Generation time is displayed in Malaysia time; CSV generation time is UTC. Source update timestamps are exported without assuming a database timezone.

CSV includes metadata, selected filters, totals, status counts and species details (including descriptions and ecological/cultural notes). It uses UTF-8 with a BOM, quotes cells and neutralizes spreadsheet formula prefixes. Photographs are not embedded. Print/PDF includes the summary and a compact inventory table; it uses the browser print dialog, not a direct PDF download library.

## Integration and access

The new route permits conservation_officer and admin. Export rechecks the session and role. These client checks are not server authorization: the existing general species API currently permits other signed-in roles too. The backend team must enforce its desired data access policy server-side; this change does not alter the general API or existing routes' role policies. No fake fallback data is used in reports.

## Verification

Production build passed. Node checks passed for combined filtering, empty results, family/status/threatened counts, CSV quoting, newlines, metadata and spreadsheet formula neutralization. Browser tests use mocked API responses, not the live PHP/database. Browser download saving was canceled by the test environment, so manually verify a CSV download on your computer.

## Suggested PR summary

Adds a conservation officer/admin biodiversity report page using the shared species API, with filters, generated preview, summary counts, CSV export and a print layout for Save as PDF. Adds the Reports navigation item and route-specific access checks. Includes error/empty states, a filter-change warning and export-session verification. No backend schema changes.

Browser verification also passed with mocked API responses for report generation, stale-filter export prevention, download triggering, print control visibility, mobile page width, server-error feedback and unauthorized-role denial. Desktop and print-media layouts were visually reviewed. Live backend/database validation and final downloaded-file saving remain to be checked in the team's environment.

Run the report data checks with: node tests/reportService.test.mjs
