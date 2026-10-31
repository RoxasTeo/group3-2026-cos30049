# Non-IoT Web acceptance and security record

Date: 2026-10-31. Workspace: `eric/web-observation-review`. Scope: Web only; Mobile and IoT business functionality excluded by the user. Verification uses disposable local PHP/MySQL fixtures, not production data. New review/map/report changes and these fixes are not yet committed or pushed.

## Functional coverage

| Scope capability | Implementation and verification |
| --- | --- |
| Species create/edit/delete | Shared database APIs; actual browser create, edit, search, cancel/confirm delete and database read-back passed. Missing targets return 404. |
| Photograph and supporting information | One JPG/PNG/WebP photograph up to 1 MiB plus description, ecological and cultural information. Actual image add/remove in browser passed; a valid PNG larger than the old 8 KiB limit persisted through HTTP and database. |
| Knowledge repository | Scientific/common names, family, genus, description, habitat, conservation status, photograph and supporting text. General User read access and management denial verified. |
| Search/filter | Scientific/common names, family and conservation status; actual browser search and existing helper checks passed. |
| Observation review | Pending queue, evidence, approve/reject/request changes, version conflict handling and history. Real HTTP/database regression passed. Mobile automatic upload and feedback/resubmission remain a separate integration. Approval does not overwrite the species knowledge record. |
| Distribution map | Linked observations with valid GPS, approved by default, optional pending observations, filters and detail return context; existing real HTTP/database and helper regressions passed. |
| Reports | Shared species data, filtered generation, CSV and browser print/Save as PDF. Real download/PDF file validation was completed in the preceding reports integration; API/helper regression rerun with this change. |
| Accounts | General User registration; administrator provisioning and role/status management. Password formats, typed input, role restrictions and real browser role navigation verified. |

## SSDLC: findings, remedies and reassessment

Threat model: unauthenticated callers, general users attempting officer/admin actions, disabled accounts with old sessions, hostile image/JSON input, cross-origin requests and accidental source/config disclosure. Review targeted Web routes, non-IoT PHP endpoints, photo handling and dependencies. IoT endpoints are explicitly excluded.

Initial findings came from code inspection; no pre-fix dynamic scan is claimed.

| Finding | Remedy | Reassessment evidence |
| --- | --- | --- |
| Old species/admin endpoints trusted cached session roles | Shared live-account login/role guard before CSRF/business work | Anonymous, unauthorized role, role downgrade, disabled account and logout denial in `tests/web_acceptance.py` |
| Explorer routes lacked login protection; admin routes allowed officer navigation | Explicit role metadata; removed duplicate unguarded monitoring route without changing IoT logic | Real browser anonymous and General User denial; officer denied admin; admin allowed |
| Photo removal accessed `form.form.photo_name` | Correct reactive property and prevent duplicate form saves | Real browser upload/remove, create with photo, edit/remove, database read-back |
| Species upload allowed 1 MiB in UI but API JSON default was 8 KiB | Explicit 2 MiB request bound and server-side decoded image validation/1 MiB limit | Valid PNG >8 KiB stored; invalid bytes/SVG/non-string input denied |
| Invalid inputs or missing edit target could produce errors/false success | Shared typed/length/status validation and locked target lookup | Invalid types/status/IDs and missing target cases pass |
| Admin-created short passwords bypassed registration policy | Enforce 12-72 byte password bound | Short and oversized password rejection passes |
| Application shell still read browser sample repository | Remove obsolete import and misleading sample-only notice | Production build and actual database browser CRUD pass |
| Schema switched databases midway | Remove CREATE DATABASE/USE from schema | Schema is applied to the explicitly selected database |

Tools/results: PHP syntax checks passed; `npm run build` passed; Node helper tests 9/9 passed; real PHP/MySQL review/map/report tests 14/14 passed; non-IoT Web acceptance/security groups 6/6 passed; browser role/login/photo/CRUD acceptance passed. `npm audit --omit=dev --json` reported zero known production dependency vulnerabilities at check time. This is a targeted assessment, not a full penetration test or proof of absence of vulnerabilities.

## Reproduce

Use only a disposable loopback database named with `_test`, set `REVIEW_TEST_FIXTURES=1`, `REVIEW_TEST_URL=http://localhost:<PHP-port>`, `REVIEW_TEST_PHP=<PHP-executable>` and DB connection variables. Start PHP serving `backend/public` with these DB settings. Seed with `php backend/tests/seed_observations.php`. Run:

```
python -m unittest discover -s backend/tests -p '*integration.py' -v
python backend/tests/web_acceptance.py
```

From `Biodiversity-Website`, run `npm run build`, `node --test tests/*.test.mjs` and `npm audit --omit=dev --json`. Test fixtures contain fictional data and are never production accounts. For the browser acceptance runner, supply Playwright through the test tooling environment (including its browser), set `REVIEW_TEST_WEB_URL=http://localhost:<Vite-port>` and `REVIEW_TEST_FIXTURES=1`, and run `node tests/web.acceptance.cjs` from `Biodiversity-Website`. It uses only the fictional fixture accounts and cleans up its species row. HTTP acceptance creates/removes its own species rows; earlier review tests leave disposable observations for inspection.

## Not certified locally

Cloud hosting, a live HTTPS certificate, database/backup encryption at rest, real remote TLS negotiation, external deployed vulnerability scanning and restore verification need deployment access and evidence. `DEPLOYMENT.md` and the read-only operator check prepare these steps without pretending they have already happened. Mobile login/offline storage/sync/review feedback and QR workflows remain for the separate Mobile task. Optional innovation is not a mandatory Web requirement.
