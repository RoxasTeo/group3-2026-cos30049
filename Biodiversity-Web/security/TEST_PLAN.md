> HISTORICAL ENCRYPTION PLAN: Field encryption and its original test tools are deferred pending Mobile integration. SEC-05, SEC-06, SEC-08 and SEC-09 below are future integration requirements, not active implementation claims. Authentication, authorization, CSRF, input, runtime-permission and business regression tests remain applicable. See [DATA_PROTECTION.md](DATA_PROTECTION.md) for migration-005 rollback. Encryption-test commands below describe the historical version and are not runnable in the current branch.

# Local Security Test Plan

Objective: verify that sensitive database fields use authenticated encryption, unauthorized requests cannot access them, migrations support recovery, and existing Web functionality remains operational. This plan provides local SSDLC evidence for security design, verification, remediation and reassessment. It is not a formal penetration test or compliance certification.

## Scope, Environment and Threat Model

- Local main Web/PHP code, an isolated loopback `*_test` MySQL database, real APIs and browsers; fictional data only.
- Attack and failure assumptions: anonymous requests, privilege escalation by ordinary users, disabled accounts, downgraded accounts with old sessions, malicious input, read-only database disclosure, ciphertext tampering or row swapping, missing keys, interrupted migration and incorrect recovery.
- Excludes physical hardware, cloud infrastructure, production TLS certificates, full host compromise, DDoS, comprehensive third-party DAST and legal compliance determinations.
- Browser tests drive actual pages with Playwright. Refresh failure tests use simulated responses and accelerated clocks. Synthetic JSON submissions simulate sensors; the backend and database run normally.

## Test Matrix

| ID | Test | Acceptance Criteria |
| --- | --- | --- |
| SEC-01 | Registration, login, incorrect passwords, throttling and logout | Valid flows work; public registration grants no privileged role; repeated failures return 429; requests after logout return 401 |
| SEC-02 | Roles, disabled accounts, role changes and object ownership | Backend rejects unauthorized access; old sessions cannot bypass current account status |
| SEC-03 | CSRF, Origin, content types and input | Invalid requests are rejected without partial writes |
| SEC-04 | SQL search, image types and text output | Queries are parameterized; malicious SVG/fake images are rejected; text is not rendered as executable HTML |
| SEC-05 | Database field confidentiality | Names, emails, observation text and review text use authenticated ciphertext with no plaintext fallback |
| SEC-06 | Cryptographic integrity | Modified tags, truncation, incorrect keys and ciphertext moved across users/fields are rejected |
| SEC-07 | Key and configuration access | Keys remain outside Git/public directories; configuration is inaccessible over HTTP; keys/data are not printed; runtime account has no DDL privileges |
| SEC-08 | Key failure and corrupted-data APIs | Only generic errors are returned; tampered profiles cannot establish login; a validly formatted but mismatched key cannot register new users |
| SEC-09 | Legacy migration and recovery | A verified encrypted snapshot is created first; IDs/password hashes/relationships survive; recovery preserves newer rows; repeated migration does not double-encrypt |
| SEC-10 | Business regression | Login, user management, review, reports, maps, historical analysis, alerts and device tracking remain operational |
| SEC-11 | Dependency checks | Record npm audit results; zero known dependency vulnerabilities must not be interpreted as proof of no vulnerabilities |

## Tools and Reproduction

Before running tests, set `REVIEW_TEST_FIXTURES=1`, operator connection variables for a loopback `*_test` database, and `REVIEW_TEST_PHP`. Standard API tests also require `REVIEW_TEST_URL=http://localhost:<test-port>`. Shared-device tests require an explicitly configured dedicated device test key. Never use production databases or real keys for fault injection.

From the repository root:

```sh
php Biodiversity-Web/backend/tests/data_protection_test.php
php Biodiversity-Web/backend/tests/audit_encrypted_data.php
python Biodiversity-Web/backend/tests/encryption_migration_test.py
python Biodiversity-Web/backend/tests/encryption_api_test.py
python -m unittest discover -s Biodiversity-Web/backend/tests -p '*integration.py' -v
python Biodiversity-Web/backend/tests/web_acceptance.py
```

The migration test creates and deletes only its own randomly named temporary database and requires operator database-creation privileges. The missing-key API test also requires `REVIEW_TEST_FAILURE_URL`, pointing to a **separate** service deliberately configured with a nonexistent key file. Do not damage the normal service configuration.

When running `runtime_permissions.php`, do not inject root credentials. It should read the actual private Web configuration and inspect runtime-account privileges. Cryptographic tests use temporary test keys in a private directory outside the repository and clean them up afterwards.

In the frontend directory, run `npm run build`, `node --test tests/*.test.mjs` and `npm audit --omit=dev --json`. Browser scripts use Playwright and `REVIEW_TEST_WEB_URL`. See `TEST_RESULTS.md`, `../TEST_RESULTS.md` and individual feature documents for specific flows.

Exit criteria: all designated tests pass, injected faults are cleaned up, no keys or plaintext data are exposed, and maintenance mode is disabled. Record each failure, its cause, remediation and reassessment of the same scenario. Skipped device-specific tests must not be reported as executed passes.
