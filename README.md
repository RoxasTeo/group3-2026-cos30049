# Niah Biodiversity — team setup guide

Smart Ground-Truthing and Digital Biodiversity System for Plant Species Documentation.

This guide sets up the React Native mobile app, Node.js backend and local MySQL database on a teammate's computer. Commands below use **Windows PowerShell**. Run them in the folder stated above each block. On macOS/Linux, use `npm` and `npx` instead of `npm.cmd` and `npx.cmd`; the project-local MySQL helper is configured for Windows, so use the manual database setup described in [backend/README.md](backend/README.md).

## 1. Requirements

| Tool | Requirement |
| --- | --- |
| Git | Access to this repository and the team's mobile branch |
| Node.js | Version 24 or newer; npm is included |
| Visual Studio Code | Open the cloned repository to edit the app |
| MySQL Server | MySQL 8.0 for the local setup below; Workbench alone does not install a running server |
| MySQL Workbench | Optional, for viewing tables |
| Phone | Expo Go compatible with this project's Expo SDK, or a matching development build |

The checked-in mobile project currently uses **Expo SDK 57**. Do not independently upgrade Expo just to match a phone client; coordinate dependency upgrades with the team. Check `mobile/package.json` if the branch changes. A custom development build needs rebuilding after native dependencies change.

Check your terminal tools:

```powershell
node --version
npm.cmd --version
git --version
```

## 2. Clone and install dependencies

For a new checkout:

```powershell
git clone --branch "qiwei/mobile-login&navigation" https://github.com/RoxasTeo/group3-2026-cos30049.git group3-mobile
cd group3-mobile
code .
```

If you already have the repository, use your existing checkout on the correct branch and preserve any uncommitted work. Do not create another copy just to run it. The instructions assume the folder is named `group3-mobile`.

From the repository root:

```powershell
cd backend
npm.cmd ci
cd ../mobile
npm.cmd ci
cd ..
```

Use the committed lockfiles. Do not copy another teammate's `node_modules`, `.env` or database directory.

## 3. Configure the backend — first time only

In `group3-mobile/backend`:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

`.env.example` is a template; `.env` contains your actual local settings. Confirm `PORT=3001` in `.env`. The next step generates the local database password and JWT secret, replacing the template database settings. Do not overwrite an existing configured `.env` with the example.

The helper expects MySQL at:

```text
C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe
```

If installed elsewhere, set its actual path in the database terminal before starting:

```powershell
$env:MYSQLD_PATH = 'D:\YourMySQLFolder\bin\mysqld.exe'
```

### Terminal 1 — start MySQL

In `group3-mobile/backend`:

```powershell
npm.cmd run db:start
```

Keep this terminal open. On first use, the helper creates a project-specific MySQL data directory and database, generates credentials, and updates backend `.env`. It does not install a Windows service. On later runs it reuses the database.

Expected connection settings:

| Setting | Value |
| --- | --- |
| MySQL hostname | `127.0.0.1` |
| MySQL port | `13306` |
| Database | `niah_biodiversity` |
| Application database user | `niah_app` |
| API port | `3001` |

### Terminal 2 — create tables, add demo data, start the API

In `group3-mobile/backend`:

```powershell
npm.cmd run db:init
npm.cmd run db:seed:dev
npm.cmd run start:lan
```

Keep this terminal open too. `db:init` creates missing tables without dropping existing ones. The development seed creates three accounts and six fictional observations on a fresh database. If `.local/demo.sqlite` exists, it imports that data instead. Existing accounts and records are preserved. Do not seed production.

Open [API readiness](http://localhost:3001/api/ready) on your computer. A working MySQL setup reports:

```json
{
  "status": "ready",
  "mode": "mysql",
  "database": "connected",
  "storage": "mysql"
}
```

`/api/health` only checks whether the API is running; `/api/ready` also checks the database. If the response says `demo`, you are using the standalone demo server instead of the shared MySQL setup.

## 4. Configure and start the mobile app

Create `group3-mobile/mobile/.env.local` in VS Code with:

```env
EXPO_PUBLIC_API_PORT=3001
```

This file is ignored by Git, so each teammate must create it. In development, the app uses the Expo computer's hostname with this API port. Do not add the old `EXPO_PUBLIC_MIGRATE_FROM_API_PORT` setting to a fresh checkout; it is only for the original demo-to-MySQL cache migration.

### Terminal 3 — start Expo

In `group3-mobile/mobile`:

```powershell
npx.cmd expo start --clear
```

Keep the computer and phone on the same trusted Wi-Fi. Open the terminal QR code with a compatible Expo client. Start at the login screen; successful Botanist login opens Home. On iOS, follow any Expo account sign-in prompt shown by the client. See [Expo's device setup instructions](https://docs.expo.dev/get-started/start-developing/).

### If the phone cannot reach the API

Run `ipconfig` on the computer and find the IPv4 address of the active Wi-Fi adapter. For example, if it is `192.168.1.20`, use:

```env
EXPO_PUBLIC_API_PORT=3001
EXPO_PUBLIC_API_URL=http://192.168.1.20:3001/api
```

Replace the example IP with your own. The URL must end with `/api`. `EXPO_PUBLIC_API_URL` overrides the inferred host and API_PORT. Restart/reload Expo after changing the file. These values are public app configuration; never put database passwords or JWT secrets in mobile environment files. See [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

Test `http://YOUR_COMPUTER_IP:3001/api/ready` in the phone's browser. If it does not open, check that `start:lan` is running, both devices are on the same network, and Windows Firewall allows Node.js on that trusted private network. `localhost` on a phone means the phone itself. Expo tunnel mode does not tunnel the backend API.

### Browser preview

In the mobile folder, use `npm.cmd run web`, or press `w` in the running Expo terminal. The exact browser origin must be listed in backend `CORS_ORIGINS`. The template includes localhost ports 8081, 8082 and 8083; add the actual origin and restart the API if Expo uses another port or hostname. Browser camera access requires HTTPS or localhost. Use a physical phone for camera/GPS acceptance testing.

## 5. Sign in and test the workflow

All seeded development accounts use password **`NiahDemo2026!`**.

| Email | Role | Initial accessible records |
| --- | --- | --- |
| botanist@example.com | Botanist | 4 |
| field.botanist@example.com | Botanist | 2 |
| officer@example.com | Conservation officer | 6 through the API |

These accounts are created by `db:seed:dev`, not by `db:init` alone. The app password above is **not** the MySQL password. Imported records remain labelled fictional; new uploads increase the record counts. Officer mobile feature tabs are still mostly placeholders, so use the Botanist account to test the implemented mobile workflow.

1. Sign in online and check Home, Records and Profile.
2. Create a new plant record with observations, a photograph and GPS.
3. Save a draft. Close/reopen the app offline and verify the draft and photo remain.
4. Mark the draft ready. Observations and GPS are required; known GPS accuracy must be within 30 metres.
5. Reconnect and open Sync → Sync all records. Confirm the status becomes Synced.
6. Open record details to see its QR tag. Scan it on a device that has downloaded the record and has access to it.

First sign-in requires the backend. Expired tokens require signing out/in before syncing; saved account records remain on the device. Clearing app storage or uninstalling removes unsynced local data.

## 6. Everyday startup and shutdown

After first-time setup, you do not need to recreate the environment files, reinstall dependencies or seed records on every run.

| Terminal | Folder | Command |
| --- | --- | --- |
| 1 | backend | `npm.cmd run db:start` |
| 2 | backend | `npm.cmd run start:lan` |
| 3 | mobile | `npx.cmd expo start --clear` |

Run `npm.cmd ci` in the relevant folder when dependency lockfiles change. To finish, stop Expo and the API with Ctrl+C. Then, in another backend terminal, run:

```powershell
npm.cmd run db:stop
```

Use `npm.cmd run db:status` to check MySQL. Do not delete `.local/mysql-data-v1` to fix a startup problem; it contains saved data.

## 7. View the database in MySQL Workbench

Create a Standard (TCP/IP) connection with hostname `127.0.0.1`, port `13306`, username `niah_app`, and optional default schema `niah_biodiversity`. Store the actual `DB_PASSWORD` value from your own backend `.env` in Workbench's vault.

After connecting, expand Schemas → niah_biodiversity → Tables. Right-click a table → Select Rows – Limit 1000.

- `users`: accounts, roles and password hashes.
- `plant_records`: observations and ownership; additional plant details, GPS and photos are in the `payload` JSON column.

Changing `.env` alone does not change a MySQL password. If rotating it, update the actual MySQL account, backend DB_PASSWORD, `.local/mysql-local.json` appPassword, and Workbench's saved password together. The setup helper rewrites DB_PASSWORD from appPassword on startup. Leave rootPassword unchanged unless you are deliberately rotating the administrator account.

## 8. Troubleshooting

| Problem | What to check |
| --- | --- |
| MySQL Server was not found | Install MySQL Server 8.0 or set MYSQLD_PATH; Workbench is only a client. |
| Cannot bind port 13306 | Check whether the project database is already running. Do not start another instance or delete its files. |
| MySQL is not ready / connection refused | Start db:start, keep it open, then run db:init before starting the API. |
| Access denied for niah_app | Clear Workbench's saved password and use DB_PASSWORD from your local .env. Do not use the mobile login password or JWT_SECRET. |
| Invalid email or password | Run db:seed:dev for a fresh local database; confirm the API is using the intended MySQL database. |
| Phone cannot sign in | Check API readiness from the phone, Wi-Fi, firewall, the computer IP and the /api suffix. |
| Expo Go SDK mismatch | Match the client/development build to SDK 57; do not upgrade individual dependencies independently. |
| Native module missing | Confirm npm ci completed and rebuild an older custom development client if native dependencies changed. |
| Browser CORS error | Add the exact browser origin to backend CORS_ORIGINS, then restart the API. |
| Only four of six samples appear | Correct for the first Botanist: the second owns two; the officer can read all six through the API. |
| Records missing after changing API address | Caches are separated by account and server address. Return to the original address to access unsent data; do not clear storage. |
| Port 3001 already in use | Reuse the correct running API or stop its known terminal before restarting it. |

For SQL account setup on an existing server or non-Windows machine, follow [backend/README.md](backend/README.md). Configure that server's actual DB_PORT and credentials instead of using db:start. Each teammate's local MySQL installation is separate: data is shared only when everyone points to the same hosted/team API.

## 9. Checks and project structure

In mobile:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:records
```

In backend:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run test:mysql
```

The separate MySQL integration test requires the project-local server running. It creates and removes its own disposable test database, leaving application records intact. Automated checks do not replace physical-device tests.

| Path | Purpose |
| --- | --- |
| mobile/src/app | Expo Router routes |
| mobile/src/screens | Login, Home, Scan, Records, Sync and Profile screens |
| mobile/src/data | Shared record store and starter species reference |
| mobile/src/services | API, offline storage, camera/GPS and sync helpers |
| backend/src | Express API, authentication, schema and database access |
| backend/scripts | Local MySQL startup, initialization and development seed |
| shared | Reusable API client for the future Vue website |

The intended data flow is `Mobile + SQLite → Node.js API → MySQL`, with the future website using the same API. See [mobile feature notes](mobile/README.md), [database details](backend/DATABASE.md), and [web integration](shared/README.md).

This setup runs locally, not in the cloud. Hosted HTTPS API/MySQL, real accounts, a verified Niah species catalogue and the remaining officer workflows are separate deployment/development work. Never commit `.env`, `.env.local`, `.local`, database files, credentials or node_modules. The README contains only development credentials, not private database credentials.
