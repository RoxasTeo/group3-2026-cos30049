# Team upgrade guide: mobile + PHP integration (November 2026)

This update connects the mobile app to the **same PHP backend and MySQL database as the Web portal**, turns on **field encryption** on the server and the phone, and completes the **IoT** scope items. After you pull it, your local setup will not start until you do the steps below once (about 15 minutes).

Full reference: [`Biodiversity-Web/SETUP.md`](Biodiversity-Web/SETUP.md) and [`mobile/README.md`](mobile/README.md).

## What changed

| Area | Change |
| --- | --- |
| Mobile | Uses the PHP backend at `/api/mobile/*` (bearer-token login). The separate Node.js backend is no longer used. Upgraded to **Expo SDK 58**. |
| Mobile → Web | Botanist uploads become observations in the Web **review queue**; officer decisions and notes show up in the app. The app's species reference is downloaded from the Web knowledge system. |
| Security (server) | User names and emails, observation field notes and habitat, and reviewer notes are stored **AES-256-GCM encrypted**. A private key file is now **required**. |
| Security (phone) | Offline records and saved photos are encrypted on the device with a key in the phone's keychain. Nothing to configure. |
| IoT | Readings may include `distance_cm` (movement/proximity) and device GPS; the server raises **automatic alerts** with severity. Existing ESP32 payloads still work. |
| Database | New migrations `006` (mobile) and `007` (IoT), plus a one-time encryption migration for existing data. |

## Steps for everyone

Run commands from the repository root in PowerShell unless stated otherwise.

### 1. Pull the update

```powershell
git switch main
git pull
```

### 2. Create your private encryption key (once per computer)

The key must live **outside** the repository. These commands create it in your Windows app-data folder:

```powershell
$privateDir = Join-Path $env:LOCALAPPDATA 'NiahBiodiversity'
New-Item -ItemType Directory -Force -Path "$privateDir\backups" | Out-Null
php Biodiversity-Web/backend/bin/generate-data-key.php "$privateDir\data.key"
$privateDir
```

The last command prints the folder path. Add these lines to `Biodiversity-Web/backend/.env`, using that path with forward slashes:

```dotenv
DATA_ENCRYPTION_KEY_FILE=C:/Users/YOUR_WINDOWS_USER/AppData/Local/NiahBiodiversity/data.key
DATA_ENCRYPTION_BACKUP_DIR=C:/Users/YOUR_WINDOWS_USER/AppData/Local/NiahBiodiversity/backups
DATA_ENCRYPTION_MAINTENANCE=false
```

Rules:

- **Never** commit the key, paste it in chat or overwrite it. The generator refuses to overwrite an existing key.
- Keep a private backup copy. If the key is lost, encrypted data in your database cannot be recovered.
- Every computer has its own key. A database copied from a teammate only works with **their** key.

### 3. Update your database (choose A or B)

#### Option A — start fresh (recommended if your local data is only test data)

Log in to MySQL as an administrator (`mysql -u root -p`) and run, replacing the path and password:

```sql
DROP DATABASE IF EXISTS biodiversity_db;
CREATE DATABASE biodiversity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'biodiversity_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_LOCAL_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON biodiversity_db.* TO 'biodiversity_app'@'localhost';
USE biodiversity_db;
SOURCE C:/full/path/to/group3-2026-cos30049/Biodiversity-Web/backend/schema.sql;
EXIT;
```

If `SOURCE` fails because the path contains spaces, import `Biodiversity-Web/backend/schema.sql` with phpMyAdmin instead.

Then recreate your accounts. **Create them with the CLI** (the first CLI account initialises encryption on an empty database):

```powershell
php Biodiversity-Web/backend/bin/create-user.php officer@example.com "Local Officer" conservation_officer
php Biodiversity-Web/backend/bin/create-user.php botanist@example.com "Local Botanist" botanist
php Biodiversity-Web/backend/bin/create-user.php admin@example.com "Local Administrator" admin
```

Each command asks for a 12–72 character password. Species records must be added again through the Web portal.

#### Option B — keep your existing data

1. **Back up** the whole database first (phpMyAdmin → Export, or `mysqldump`).
2. Apply the two new SQL migrations as an administrator (`mysql -u root -p`):

   ```sql
   USE biodiversity_db;
   SOURCE C:/full/path/to/group3-2026-cos30049/Biodiversity-Web/backend/migrations/006_mobile_api.sql;
   SOURCE C:/full/path/to/group3-2026-cos30049/Biodiversity-Web/backend/migrations/007_iot_movement_gps_alerts.sql;
   EXIT;
   ```

3. Stop the PHP server, then set `DATA_ENCRYPTION_MAINTENANCE=true` in `Biodiversity-Web/backend/.env`.
4. Encrypt the existing data. The tool changes table columns, so run it with an administrator database account in this terminal only:

   ```powershell
   $env:DB_USER = 'root'
   $secret = Read-Host 'MySQL root password' -AsSecureString
   $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --apply
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   Remove-Item Env:DB_USER, Env:DB_PASSWORD
   ```

   The first check exits with code 2 (migration pending); after `--apply` the final check must print `plaintext fields: 0` and exit with 0 (check with `$LASTEXITCODE`). The tool keeps IDs, password hashes and relationships, and writes an encrypted snapshot to your backups folder.
5. Set `DATA_ENCRYPTION_MAINTENANCE=false` again.

### 4. Start the backend and Web portal

Serve PHP on all interfaces so phones on your Wi-Fi can reach it:

```powershell
php -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public
```

In a second terminal:

```powershell
cd Biodiversity-Web/Biodiversity-Website
npm ci
npm run dev
```

Open http://localhost:5173 and sign in. If login returns a generic error, see Troubleshooting.

### 5. Check it works

- Web: sign in as the officer; Observations, Species, Reports and Monitoring load.
- Optional server check: `php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check` exits with 0.

## Running the mobile app (only if you test mobile)

1. Install the latest **Expo Go** on your phone (SDK 58). Phone and computer must be on the same Wi-Fi.
2. Keep the PHP server from step 4 running on `0.0.0.0:8080`.
3. In a new terminal:

   ```powershell
   cd mobile
   npm ci
   npx expo start
   ```

4. Scan the QR code (iPhone: Camera app; Android: inside Expo Go).
5. Sign in with a **botanist** or **conservation_officer** account. Admin and General User accounts are Web-only.
6. Quick test: New plant record → photo + GPS → Mark ready → Sync. As the officer on the Web, the record appears under Observations; review it, then pull to refresh Records on the phone to see the decision.

If PHP runs on another port, set it before starting Expo, e.g. `$env:EXPO_PUBLIC_API_PORT = '8091'`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Every request returns 500 / "Internal server error" | Check `DATA_ENCRYPTION_KEY_FILE` points to your key (absolute path, outside the repository) and that step 3 is done. The PHP terminal shows the exact error. |
| 503 "Data protection maintenance in progress" | Set `DATA_ENCRYPTION_MAINTENANCE=false` and restart PHP. |
| "Database encryption key does not match" | The database was encrypted with a different key (for example a teammate's dump). Use the matching key or start fresh (Option A). |
| `create-user.php` fails on a fresh database | Run step 2 first; the key file must exist. |
| Expo Go: "Project is incompatible with this version of Expo Go" | Run `npm ci` in `mobile` after pulling; the project now uses SDK 58. |
| Phone: stuck loading, or "Cannot reach the sign-in server" | Allow Node.js (port 8081) and PHP (port 8080) through Windows Firewall for **Private** networks, and use the same Wi-Fi. |
| Phone: "This account uses the Web portal" | Sign in with a botanist or conservation officer account. |
| Photo upload fails with a size error | Use XAMPP's PHP (allows 40 MB) or start PHP with `php -d post_max_size=32M -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public`. |
