> Current status (2026-11-01): application-level sensitive-field encryption is deferred until Mobile integration. Do not apply migration 005 or configure a new field-encryption key for a fresh installation. Previously encrypted databases require the [rollback guide](security/DATA_PROTECTION.md).

# Web deployment and data protection

This workspace is locally verified, not deployed or certified for production. Hardware, Mobile synchronization and cloud deployment remain separate; server-side IoT processing is implemented. Do not interpret a password hash as encryption of personal data.

## Database and API

1. Create the selected database explicitly and import `backend/schema.sql` into it. The schema no longer changes the selected database halfway through import. For an existing species/authentication database, apply `backend/migrations/001_observation_review.sql`; back up before migrations. Do not import test fixtures.
2. Give a dedicated runtime user only SELECT/INSERT/UPDATE/DELETE on the application's tables; use a different operator account for schema changes. Never deploy test root credentials.
3. Serve only `backend/public` as the PHP document root. Keep `.env`, SQL, test scripts, logs and CLI tools outside public access. Build and serve `Biodiversity-Website/dist`; proxy `/auth` and `/api` to PHP on the same HTTPS origin. The Vite development server is not a production server.
4. Set `APP_ENV=production`, `APP_ORIGIN=https://<your-domain>`, `COOKIE_SECURE=true` and private DB credentials. A remote database requires `DB_SSL_CA` pointing to its trusted CA certificate. Certificate verification is enabled and the application checks that an encrypted connection was actually negotiated. See the [PHP PDO MySQL documentation](https://www.php.net/manual/en/ref.pdo-mysql.php).
5. Use a valid HTTPS certificate at the reverse proxy. Redirect HTTP to HTTPS; configure HSTS after verifying HTTPS. Disable PHP error display; preserve private error logs. Permit JSON photo uploads up to 29 MiB for observation submissions, with request/time limits and edge rate limits. Species photos remain limited to 1 MiB each.
6. Run `php backend/bin/check-deployment.php` privately. It checks secure configuration, connectivity/TLS and InnoDB tables without writing or exposing credentials. A pass is not evidence that cloud storage is encrypted.

## Encryption and operational evidence still required

Enable encryption at rest for the managed database/disk, logs containing personal data and backups; keep keys in the provider's managed key service with restricted access and rotation. Record the provider settings and a successful backup/restore check. These require the team's actual hosting account and cannot be established by local application code. Application-level encryption of user profiles and observation/review text is deferred until joint Mobile integration. Fresh installations need no field-encryption key. Previously encrypted databases require the operator rollback described in `security/DATA_PROTECTION.md`.

Passwords use bcrypt hashing. Sessions use HttpOnly, SameSite cookies with Secure required for production. Writes require CSRF tokens and roles are reloaded from the account on every protected non-IoT API request. General users can read the knowledge repository; only officers/admins manage species and review/export records. Botanists use field submission APIs and do not gain Web management access.

## Release verification

Run the non-IoT acceptance tests described in `WEB_ACCEPTANCE.md`, then verify on the deployed HTTPS origin: login/logout and timeouts, cookie flags, no access to private paths, account suspension, role changes, actual photograph CRUD, review/history, map filters, real CSV/PDF export. Perform an external vulnerability scan and manually verify findings, fix them and repeat the same scan. Record results against the deployed commit and environment; the local results do not certify a future deployment.


Tracking deployments must also apply migration 004 before using the updated monitoring APIs; follow `TRACKING.md`. Keep per-device upload keys private. Tested local functionality is not evidence of hardware or production readiness.


Before using this version with a database previously encrypted by migration 005, complete the documented rollback using its original key. Do not apply the former encryption migration to a fresh database. Runtime credentials need only data read/write grants; schema migration and security fault-injection tests require separate operator privileges. See `security/TEST_PLAN.md` and `security/TEST_RESULTS.md`.
