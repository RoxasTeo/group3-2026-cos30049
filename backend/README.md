# Niah Node.js backend

Express 5 API with a MySQL production adapter and a persistent SQLite demo mode. Node.js 24+ is required.

## Current shared MySQL setup

MySQL is configured on port 13306 and the API uses port 3001. Run `npm.cmd run db:start` in one terminal and `npm.cmd run start:lan` in another. See [DATABASE.md](DATABASE.md) for mobile setup and future web integration.

## Optional standalone demo

```powershell
npm.cmd ci
npm.cmd run demo:lan
```

Use `npm.cmd run demo` for localhost-only testing. Do not run both on port 3000. LAN demo is intended for fictional data on trusted Wi-Fi and is blocked when NODE_ENV is production. The mobile app uses `http://COMPUTER_WIFI_IP:3000/api`.

Demo accounts use password `NiahDemo2026!`: `botanist@example.com` (four initial records), `field.botanist@example.com` (two), and `officer@example.com` (access to all six). Every demo submission remains marked fictional. These credentials must never be used for production.

Demo records and normalized photos persist in ignored `.local/demo.sqlite`. Do not delete it if you need your test uploads. JWT_SECRET from `.env` is used when present; without it, demo generates a temporary secret and existing tokens stop working after restart. A local `.env` is already configured in this checkout. Shared MySQL is now configured as described above. Prior initialization logs in `.mysql/` remain unchanged.

## 1. Configure MySQL

Start a MySQL 8 server (Workbench manages connections; it is not the server itself).
XAMPP's MariaDB may work but has not been verified for this project.

1. Open a local administrator connection in MySQL Workbench or phpMyAdmin.
2. Open `scripts/setup-database.sql`, replace the password placeholder, and run it.
3. Edit `.env` with the same DB password, host, port and database name. Do not commit `.env`.
4. Run `npm.cmd run db:init`. It creates missing tables without dropping existing data.

For a new checkout, run `npm.cmd ci`, copy `.env.example` to `.env`, then generate a JWT secret:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put that value into `JWT_SECRET`. Do not share it or paste it into mobile code.
The database user has permissions only on the project database. Production deployments
should use a separate migration account and remove CREATE/INDEX/REFERENCES from the runtime user.

## 2. Create an account

Accounts are provisioned from the backend terminal; clients cannot grant themselves roles.
In PowerShell:

```powershell
$env:NEW_USER_NAME = 'Your name'
$env:NEW_USER_EMAIL = 'botanist@example.com'
$env:NEW_USER_ROLE = 'botanist'
$secretInput = Read-Host 'New password (at least 12 characters)' -AsSecureString
$env:NEW_USER_PASSWORD = [System.Net.NetworkCredential]::new('', $secretInput).Password
try { npm.cmd run user:create } finally { Remove-Item Env:NEW_USER_PASSWORD }
```

Use `conservation-officer` for an officer account. Existing accounts are never overwritten.
Passwords are salted and hashed with Node's scrypt. No default login account is created.

## Start MySQL mode

Run `npm.cmd run dev` or `npm.cmd start` after database configuration. These commands do not load demo users. Set HOST=0.0.0.0 for LAN access; default is localhost. Configure CORS_ORIGINS for exact browser origins. `/api/health` reports process health; `/api/ready` checks repository readiness and storage mode.

## API and synchronization

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/auth/login | Email/password → token, expiresIn, user |
| GET | /api/auth/me | Current authenticated user |
| GET | /api/plants?search=fern&limit=25&offset=0 | Owned records; officers can read all |
| GET | /api/plants/:plantId | Read accessible record including photos |
| POST | /api/plants | Botanist submits a complete observation |

Protected endpoints require a Bearer token. Tokens expire after one hour. The server reads roles from its repository on every request. Mobile offline access does not bypass server token validation.

POST fields: plantId, commonName, scientificName, family, conservationStatus, description, habitatNotes, heightMetres (optional numeric string 0–150), morphology (optional), location, photos. Description and valid GPS are required. Known GPS accuracy must be ≤30 m. Each photo is `{ id, caption, data: "data:image/jpeg;base64,..." }`; native file paths are not upload data.

At most four photos, each ≤5 MB and ≤40 megapixels. JPEG, PNG and WebP input is decoded and re-encoded to JPEG, maximum bounding box 1600 × 1600, quality 80, without metadata. The normalized image is stored in the authenticated record JSON in MySQL or demo SQLite. There are no public media URLs. Request body limit: 28 MB. For larger deployments, migrate image bytes to private object storage and use signed/authenticated downloads.

New records return 201 after persistence. An identical normalized submission from the same owner returns 200 with the original record, making retries safe after a lost response. Different content or another owner's ID returns 409. No existing record is overwritten. The backend supplies ownership, timestamps and Synced status. The client never submits status, sample or owner.

## Validation and deployment limits

```powershell
npm.cmd test
npm.cmd run check
```

Tests cover authentication, ownership, roles, validation, image upload, duplicate-safe retry, SQLite restart persistence and rate limits. MySQL integration is checked by `npm.cmd run test:mysql`; physical phone acceptance remains to be tested. The local demo is not a hosted cloud deployment. Production still requires an accessible HTTPS host, a configured MySQL server, real accounts and backups. Existing MySQL schema stores new fields/photos in payload JSON, so no destructive migration is required.

Not included: server updates/deletes, conflict merging, officer approvals, background sync, account recovery, refresh-token revocation, reporting or IoT endpoints. Keep `.env`, `.local/`, `.mysql/` and database credentials out of Git.
