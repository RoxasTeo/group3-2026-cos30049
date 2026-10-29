# Niah Node.js backend

Express 5 + MySQL API for the React Native app. Requires Node.js 24 or newer.

## Current setup status

Dependencies are installed. A local ignored `.env` contains a generated JWT signing secret.
The API and automated HTTP tests run, but MySQL is not connected yet. A project-local
MySQL initialization was attempted in `.mysql/` and failed to start with an InnoDB undo
tablespace error; its logs are retained there for diagnosis. No existing database was changed.

Mobile login is connected to this API. Plant records and Sync still use the mobile session-only sample store.

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

## 3. Start the API

```powershell
npm.cmd run dev
```

- `http://localhost:3000/api/health`: API is running.
- `http://localhost:3000/api/ready`: verifies database tables; returns 503 until configured.
- `npm.cmd start`: run without file watching.
- `npm.cmd test`: HTTP tests using an isolated in-memory test repository (not a real MySQL integration test).
- `npm.cmd run check`: JavaScript syntax checks.

## API contract

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /api/health | Public liveness |
| GET | /api/ready | Public database readiness |
| POST | /api/auth/login | `{ "email": "...", "password": "..." }` -> token, expiresIn, user |
| GET | /api/auth/me | Current authenticated user |
| GET | /api/plants?search=fern&limit=25&offset=0 | Search records, bounded pagination |
| GET | /api/plants/:plantId | Read an accessible plant |
| POST | /api/plants | Botanist submits one completed plant record |

Protected endpoints require `Authorization: Bearer <token>`. Tokens expire after one hour;
roles are reloaded from the database on every request. Botanists read their own records;
officers can read all records. This is an initial conservative ownership policy for team review.

Example POST /api/plants body:

```json
{
  "plantId": "NIAH-PLANT-100",
  "commonName": "Field observation",
  "scientificName": "",
  "family": "",
  "conservationStatus": "Not assessed",
  "description": "Observed near the trail.",
  "habitatNotes": "Shaded ground",
  "location": { "latitude": 3.81, "longitude": 113.78, "accuracy": 10 },
  "photos": []
}
```

An insert returns 201 only after MySQL saves the record. The server supplies timestamps,
owner and `Synced` status. Duplicate IDs return 409, never overwrite data. Invalid inputs
return 400; unauthenticated requests 401; disallowed roles 403; inaccessible records 404.
A retry after a lost upload response must compare the existing server record before treating
a duplicate as success. There is no complete batch/conflict-resolution sync protocol yet.

## Phone and mobile integration

Set `HOST=0.0.0.0` in backend/.env for LAN testing, then restart. On the phone use your
computer's Wi-Fi IPv4 address, for example `http://192.168.1.10:3000/api/health`.
`localhost` on a phone means the phone itself. Both devices must be on the same Wi-Fi;
Windows may ask you to allow Node on private networks. The backend uses port 3000,
separate from Expo's port. CORS_ORIGINS lists allowed browser origins; native Expo Go
requests do not require a browser origin.

Next mobile integration work: add persistent secure token storage if needed, refresh profiles through /auth/me,
map the record form to the POST schema, and update Sync only after confirmed server saves.
Do not send local-only fields such as status, sample, owner, createdAt or updatedAt.

## Remaining features and deployment

Not implemented: photo binary uploads, plant updates/deletes, officer approval, QR generation,
offline device storage, automatic/batch sync, password reset, token refresh/revocation, reporting
and IoT endpoints. Photos currently must be an empty array: file:// phone paths are not server uploads.
Tests cover authentication, access control, validation, duplicate conflicts and rate limiting;
real MySQL persistence and device integration still need verification.

This is a local development foundation. Use HTTPS for deployment, managed secrets, database
backups/encryption and a shared rate-limit store before running multiple server instances.
Never commit `.env`, `.local/`, `.mysql/`, or database credentials.

## Run with mock data (no MySQL needed)

Stop any API already using port 3000, then run:

```powershell
npm.cmd run demo
```

Demo API: `http://127.0.0.1:3000/api`. Check `/health` and `/ready` to see `mode: demo`.

| Email | Password (development only) | Role | Visible sample records |
| --- | --- | --- | --- |
| botanist@example.com | NiahDemo2026! | Botanist | 4 |
| field.botanist@example.com | NiahDemo2026! | Botanist | 2 |
| officer@example.com | NiahDemo2026! | Conservation Officer | 6 |

Example PowerShell request:

```powershell
$loginBody = @{ email = 'botanist@example.com'; password = 'NiahDemo2026!' } | ConvertTo-Json
$login = Invoke-RestMethod 'http://127.0.0.1:3000/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
Invoke-RestMethod 'http://127.0.0.1:3000/api/plants' -Headers @{ Authorization = "Bearer $($login.token)" }
```

The six observations cover a canopy tree, fern, palm, climbing plant, seedling and ground herb.
Names, notes and coordinates are fictional examples, not verified species identifications or
conservation records. Every demo record has `sample: true`; `Synced` represents a simulated
server record, not a real upload. Photos are intentionally empty because media upload is not built.

Demo changes stay in memory and reset when the server restarts. Tokens also reset. Demo mode
binds only to this computer (127.0.0.1), ignores HOST, and refuses NODE_ENV=production.
`npm run dev` and `npm start` still use real MySQL; they do not load demo accounts.

This adds mock data to the backend only. The mobile app still has its existing local mock
records; login is connected, while Sync is not yet connected.

## Connected mobile login

The mobile login now calls /api/auth/login and uses the returned role and account details.
Start `npm.cmd run demo` for a browser on this computer, or `npm.cmd run demo:lan` for
Expo Go on a phone. The LAN command explicitly binds the demo API to 0.0.0.0:3000;
use it only with demo credentials on trusted Wi-Fi. Standard demo mode remains localhost-only.
Both modes remain disabled in production. Do not run both commands at the same time.

The mobile app infers the computer's host from Expo in development. Override with
EXPO_PUBLIC_API_URL in mobile/.env.local when needed. Login is connected; record browsing
and Sync still use the mobile preview store. Sessions are memory-only and expire after one hour.
