# Team setup guide (November 2026)

The mobile app now uses the **same PHP backend and MySQL database as the Web portal**. Sensitive data is **encrypted** on the server and the phone, and the **IoT** monitoring is complete. One script sets everything up, including shared **demo accounts and sample data**.

## What changed

| Area | Change |
| --- | --- |
| Mobile | Uses the PHP backend at `/api/mobile/*` (bearer-token login). The separate Node.js backend is no longer used. Upgraded to **Expo SDK 58**. |
| Mobile → Web | Botanist uploads become observations in the Web **review queue**; officer decisions and notes show up in the app. The app's species reference comes from the Web knowledge system. |
| Security | Names, emails, field notes, habitat and reviewer notes are stored **AES-256-GCM encrypted** with a private key on each computer. Offline records and photos on the phone are encrypted too. |
| IoT | Readings may include `distance_cm` and device GPS; the server raises **automatic alerts** with severity. Existing ESP32 payloads still work. |

## Before you start

Install these once:

- **XAMPP** (PHP 8.2 and MySQL/MariaDB). Another MySQL install also works.
- **Node.js** (LTS).
- **Expo Go** on your phone, latest version (SDK 58). Only needed to test the mobile app.

## Setup steps

1. **Start MySQL.** Open the XAMPP Control Panel and click **Start** next to MySQL.

2. **Get the latest code.** In PowerShell, from the repository root (the folder with `README.md`):

   ```powershell
   git switch main
   git pull
   ```

3. **Run the setup script with demo data:**

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 -Demo
   ```

4. **Enter the MySQL root password** when asked. With XAMPP it is empty: just press **Enter**.

5. **Wait for "Setup complete".** The script prints each step in green. It:
   - creates your private encryption key in `%LOCALAPPDATA%\NiahBiodiversity` (outside the repository);
   - creates `Biodiversity-Web/backend/.env`;
   - creates the `biodiversity_db` database and its tables (or upgrades an existing one, after saving a backup);
   - adds the demo accounts and sample data;
   - checks the backend can use the database;
   - installs the Web and mobile dependencies (`npm ci`).

   If it stops with a red **SETUP STOPPED** message, the message says what to fix. Fix it and run step 3 again; the script is safe to re-run. See also [Troubleshooting](#troubleshooting).

6. **Start the PHP backend** (keep this terminal open):

   ```powershell
   C:\xampp\php\php.exe -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public
   ```

7. **Start the Web portal** in a second terminal:

   ```powershell
   cd Biodiversity-Web/Biodiversity-Website
   npm run dev
   ```

   Open http://localhost:5173 and sign in with a demo account below.

8. **Start the mobile app** (optional) in a third terminal:

   ```powershell
   cd mobile
   npx expo start
   ```

   Scan the QR code (iPhone: Camera app; Android: inside Expo Go). Your phone and computer must be on the same Wi-Fi. To use the app in a browser instead, press **w**.

## Demo accounts

| Role | Email | Password | Signs in to |
| --- | --- | --- | --- |
| Conservation officer | `officer@niah.demo` | `NiahDemo@2026` | Web and mobile |
| Botanist | `botanist@niah.demo` | `NiahDemo@2026` | Web and mobile |
| Admin | `admin@niah.demo` | `NiahDemo@2026` | Web only |

Sample data included:

- **5 species** in the knowledge base (Bornean ironwood, agarwood, two pitcher plants, Rafflesia).
- **4 botanist observations** with GPS and photos: one approved, one with changes requested (with reviewer notes), two pending review.
- **2 tracked plants** with sensors, 24 hours of readings and 3 alerts on the Monitoring page.

Sample data is only added to a database that has no species, observations or tracked plants, so running the script again never duplicates or overwrites anything.

These passwords are public. Use them **only on your own computer**; the script refuses to add them when `APP_ENV=production`.

## Quick test

1. Web: sign in as **officer**. Observations, Species, Reports and Monitoring all show data.
2. Mobile: sign in as **botanist**. Records shows the 4 sample observations; the one with changes requested shows the reviewer's notes.
3. Mobile: **New plant record** → photo + GPS → **Mark ready** → **Sync**.
4. Web: as the officer, the new record appears under Observations. Review it, then pull to refresh Records on the phone to see the decision.

## Script options

| Option | Use |
| --- | --- |
| `-Demo` | Add the demo accounts and sample data (recommended). Without it, the script asks for your own account details. |
| `-SkipNpm` | Skip `npm ci`, for example when dependencies are already installed. |
| `-DbName`, `-DbHost`, `-DbPort` | Use a different database name, host or port (defaults: `biodiversity_db`, `localhost`, `3306`). |
| `-SkipAccounts` | Create no accounts. |

Stop the PHP server before re-running the script on an existing database.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `php` is not recognized | Use the full path `C:\xampp\php\php.exe` instead of `php`, or add `C:\xampp\php` to PATH and reopen the terminal. |
| Setup stops with "Can't connect to MySQL" | Start MySQL in the XAMPP Control Panel. |
| Setup stops with "schema.sql did not create these tables" or "Index for table ... is corrupt" | XAMPP's MySQL is damaged (usually after an unclean shutdown). Check `C:\xampp\mysql\data\mysql_error.log`, back up `C:\xampp\mysql\data`, and repair it (for a corrupt table: `REPAIR TABLE mysql.db;` as root), then run the script again. |
| Login says "No accounts exist yet" | Run step 3 again with `-Demo`. |
| Every request returns 500 / "Internal server error" | The PHP terminal shows the exact error. Usually `DATA_ENCRYPTION_KEY_FILE` in `.env` does not point to your key; run step 3 again. |
| "Database encryption key does not match" | The database was encrypted with a different key (for example a teammate's database dump). Each computer uses its own key; do not share databases or keys. |
| 503 "Data protection maintenance in progress" | Set `DATA_ENCRYPTION_MAINTENANCE=false` in `.env` and restart PHP. |
| Expo Go: "Project is incompatible with this version of Expo Go" | Update Expo Go and run `npm ci` in `mobile`. |
| Phone: stuck loading, or "Cannot reach the sign-in server" | Allow Node.js (port 8081) and PHP (port 8080) through Windows Firewall for **Private** networks, and use the same Wi-Fi. |
| Mobile app in the browser (`localhost:8081`): "Cannot reach the sign-in server", PHP shows `403 OPTIONS` | Set `MOBILE_WEB_ORIGINS=http://localhost:8081` in `Biodiversity-Web/backend/.env` (the setup script does this). No restart needed. |
| Phone: "This account uses the Web portal" | Sign in as the botanist or officer; admin accounts are Web only. |
| Photo upload fails with a size error | Use XAMPP's PHP (allows 40 MB), or start PHP with `php -d post_max_size=32M -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public`. |

Full reference and manual setup: [`Biodiversity-Web/SETUP.md`](Biodiversity-Web/SETUP.md) and [`mobile/README.md`](mobile/README.md).


## Mobile records update — 8 November 2026

### Shared records and filters

- Botanists can now view synced plant observations submitted by every Botanist, including photographs, GPS information and review status.
- Drafts and unsent records remain private to the account that created them.
- Synced records remain read-only in the mobile app.
- The **Recorded by me** filter shows only the signed-in Botanist’s own records, including local drafts.
- Every filter displays a count, such as **All - 7**, **Recorded by me - 4**, **Drafts - 0**, **Pending sync - 0**, **Synced - 7** and **Failed - 0**.
- Counts update when local records or upload statuses change. While searching, counts include only matching records.
- Pull down on Records to load observations recently uploaded by other Botanists.
- Shared observations have distinct internal IDs so records with the same plant tag do not overwrite one another.

### Updating an existing installation

1. Get the latest code containing these changes. Update both the mobile app and PHP backend.
2. Start MySQL and the PHP backend, then reload the mobile app.
3. Pull down on the Records page to refresh.

No database migration or additional dependencies are required for these changes.

### Add a second demo Botanist

With the local database configured and running, execute this command from the repository root:

```powershell
C:\xampp\php\php.exe Biodiversity-Web/backend/bin/seed-second-botanist.php
```

The script creates:

| Name | Email | Password |
| --- | --- | --- |
| Demo Botanist Two | `botanist2@niah.demo` | `NiahDemo@2026` |

It also adds three fictional observations:

- Bird nest fern — DEMO
- Pitcher plant — DEMO
- Unidentified seedling — DEMO

These observations contain illustrative measurements and GPS coordinates, with no photographs attached. They are not verified field survey data.

The script preserves existing accounts and observations. Running it again does not duplicate these records or reset an existing account’s password. It requires `APP_ENV=development`.

Each teammate using a separate local database must run this command themselves; pulling the code does not copy database records. The original `-Demo` setup does not include this second account.

### Test sharing between Botanists

For a database containing the original four demo observations and the three new observations:

| Account | All | Recorded by me |
| --- | ---: | ---: |
| `botanist@niah.demo` | 7 | 4 |
| `botanist2@niah.demo` | 7 | 3 |

1. Sign in with the original Botanist account and refresh Records.
2. Confirm that **All** includes the second Botanist’s observations.
3. Select **Recorded by me** and confirm that only the original account’s records appear.
4. Sign out and repeat with the second Botanist account.
5. Create a draft: **Drafts**, **All** and **Recorded by me** should increase.
6. Upload the record successfully: **Synced** should increase.
7. Sign in with the other account and refresh to see the newly uploaded record.

Counts will differ if additional records or local drafts already exist.
