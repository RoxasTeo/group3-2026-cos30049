# Shared database setup

MySQL: `127.0.0.1:13306`, database `niah_biodiversity`. Shared API: `http://localhost:3001/api`. On a phone, use the computer's Wi-Fi address instead of localhost. Mobile SQLite remains the offline store.

## Start after restarting the computer

Keep three terminals open:

1. In backend: `npm.cmd run db:start`
2. In backend: `npm.cmd run start:lan`
3. In mobile: `npx.cmd expo start --clear`

Check MySQL with `npm.cmd run db:status`. Stop the API before running `npm.cmd run db:stop`. MySQL data lives in `.local/mysql-data-v1`. No Windows service or other database is changed. MYSQLD_PATH can override the installed server binary.

For a new checkout, install dependencies, start MySQL, then run `npm.cmd run db:init`. Optional `npm.cmd run db:seed:dev` imports the existing demo SQLite data or the six original fixtures, without overwriting records or passwords. Never seed production.

## Development accounts

Password: `NiahDemo2026!`.

| Email | Role | Initial records |
| --- | --- | --- |
| botanist@example.com | Botanist | Four |
| field.botanist@example.com | Botanist | Two |
| officer@example.com | Conservation officer | All six |

The six imported records remain labelled fictional. New MySQL submissions are normal records. The original `.local/demo.sqlite` is preserved.

## Schema and website integration

`users` stores IDs, names, unique emails, salted password hashes, roles and creation timestamps. `plant_records` stores unique plant IDs, owner foreign keys, searchable common/scientific names, timestamps and JSON payloads containing taxonomy, notes, height, morphology, GPS, photos and retry hashes. Responses include ownerId.

The future Vue app uses the same authenticated API, never MySQL credentials. See `../shared/README.md` and `../shared/niah-api.mjs`. localhost:5173 and 127.0.0.1:5173 are configured CORS origins. Officer editing, approval and reporting endpoints remain future work; current officer access is read-only.

## Configuration

Credentials remain in ignored `.env` and `.local/mysql-local.json`. The previous environment file is backed up in `.local/env-before-local-mysql`. Never commit these files or put database credentials in a frontend.

API port 3001 avoids the older demo API on 3000. Mobile `.env.local` sets EXPO_PUBLIC_API_PORT=3001 and EXPO_PUBLIC_MIGRATE_FROM_API_PORT=3000. The latter explicitly copies the same account's previous offline cache only when the destination does not exist, retaining the source copy. This assumes the matching account IDs imported during this migration. Remove the migration setting for unrelated servers or production. EXPO_PUBLIC_API_URL overrides API_PORT.

## Verification and hosting

Run `npm.cmd test`, `npm.cmd run test:mysql`, and `npm.cmd run check`. The MySQL test creates a disposable database and verifies mobile-style uploads, authorized web reads, photo/GPS persistence, retry and CORS; it deletes only its own test database.

This is local development, not cloud hosting. Later configure hosted MySQL credentials, DB_SSL_CA if required, an HTTPS API URL, deployed CORS origins, backups and real accounts. Keep MySQL private behind the API. Physical-phone testing remains necessary.
