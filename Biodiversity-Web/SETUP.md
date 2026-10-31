# Web Setup Guide (Local Development)

This guide takes a teammate from pulling `main` to logging in to the Web application. It covers the Vue frontend, PHP backend, local database, private encryption key and initial accounts. Mobile setup, physical IoT devices and production deployment are separate tasks.

Commands below use **Windows PowerShell** unless marked SQL. Run them from the **repository root** (the folder containing `Biodiversity-Web`), except where a different directory is explicitly specified. Replace example paths, names and passwords with your own values.

## 1. Requirements and Code

Install and start:

- Node.js matching `^22.18.0 || >=24.12.0`, plus npm.
- PHP 8.1+ with PDO MySQL, OpenSSL and image inspection support (`getimagesizefromstring`).
- MySQL or MariaDB with InnoDB support. XAMPP can provide PHP and MariaDB; start its database service. Apache is not required for the PHP development server used here.
- Git and a browser.

Check your tools:

```powershell
git --version
node --version
npm --version
php --version
php -r 'echo "pdo_mysql=".(extension_loaded("pdo_mysql") ? "yes" : "no").PHP_EOL."openssl=".(extension_loaded("openssl") ? "yes" : "no").PHP_EOL."image inspection=".(function_exists("getimagesizefromstring") ? "yes" : "no").PHP_EOL;'
```

If XAMPP tools are not on PATH, add them for the current terminal (adjust installation paths):

```powershell
$env:Path = "C:\xampp\php;C:\xampp\mysql\bin;" + $env:Path
```

In your existing checkout, preserve any local changes before switching branches:

```powershell
git switch main
git pull --ff-only origin main
```

For a new checkout:

```powershell
git clone https://github.com/RoxasTeo/group3-2026-cos30049.git
cd group3-2026-cos30049
git switch main
```

**Choose the correct database path:** Sections 2-6 are for a new, empty local database. If you already have project data, use section 9 instead. Pulling Git does not download another teammate's database, accounts, passwords or encryption key.

## 2. Create a Fresh Database and Runtime Account

Start MySQL/MariaDB, then connect with a database administrator account:

```powershell
mysql -u root -p
```

Enter your local administrator password when prompted. A local installation with no root password may accept Enter. Do not use root as the Web runtime account.

In the MySQL prompt, run the following **SQL**, replacing the example password with a strong local password:

```sql
CREATE DATABASE biodiversity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'biodiversity_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_LOCAL_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON biodiversity_db.* TO 'biodiversity_app'@'localhost';
USE biodiversity_db;
SOURCE C:/full/path/to/group3-2026-cos30049/Biodiversity-Web/backend/schema.sql;
EXIT;
```

Replace the `SOURCE` path with your actual absolute path, use forward slashes, and run it as the administrator so tables can be created. If your path contains spaces and the client cannot load it, use phpMyAdmin: select `biodiversity_db`, choose **Import**, and import `Biodiversity-Web/backend/schema.sql`.

The current schema includes all required tables for a fresh installation. Do not additionally run old migrations on that fresh database. It contains no preconfigured login accounts or demonstration records.

## 3. Generate a Private Encryption Key

Create a private directory **outside every Git repository**. This example uses your Windows application-data directory:

```powershell
$privateDir = Join-Path $env:LOCALAPPDATA 'NiahBiodiversity'
New-Item -ItemType Directory -Force -Path "$privateDir\backups" | Out-Null
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $privateDir /inheritance:r /grant:r "${currentIdentity}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F'
php Biodiversity-Web/backend/bin/generate-data-key.php "$privateDir\data.key"
```

The ACL command limits inherited access and grants the current Windows user and SYSTEM access. Confirm it succeeds before continuing. These instructions run PHP under your current user; a different service account needs appropriate explicit permissions.

The generator creates a random key without printing it and refuses to overwrite an existing file. If `data.key` already exists, preserve it and establish which database it belongs to. Never replace the key of an encrypted database with a newly generated key.

Keep a separate secure backup of the key. Losing it makes the encrypted fields and encrypted migration snapshots unrecoverable. Do not commit it or paste it into group chat.

## 4. Configure the Backend

Copy the example only if you do not already have a local `.env`:

```powershell
Copy-Item Biodiversity-Web/backend/.env.example Biodiversity-Web/backend/.env
```

Edit `Biodiversity-Web/backend/.env`. Keep the other example settings and change these entries:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=biodiversity_db
DB_USER=biodiversity_app
DB_PASSWORD=REPLACE_WITH_YOUR_LOCAL_DB_PASSWORD
APP_ORIGIN=http://localhost:5173
APP_ENV=development
COOKIE_SECURE=false
DATA_ENCRYPTION_KEY_FILE=C:/Users/YOUR_WINDOWS_USER/AppData/Local/NiahBiodiversity/data.key
DATA_ENCRYPTION_BACKUP_DIR=C:/Users/YOUR_WINDOWS_USER/AppData/Local/NiahBiodiversity/backups
DATA_ENCRYPTION_MAINTENANCE=false
```

Use the absolute paths generated in section 3 and your actual database port. To see the directory path without exposing the key, run `$privateDir`. The `.env` loader expects plain `KEY=value` lines: no quotes, variable substitution or inline comments. Environment variables override `.env`; remove stale `DB_*` or `DATA_ENCRYPTION_*` overrides from your terminal if they point at another setup.

Protect the local configuration file too:

```powershell
icacls Biodiversity-Web/backend/.env /inheritance:r /grant:r "${currentIdentity}:F" '*S-1-5-18:F'
git check-ignore Biodiversity-Web/backend/.env
```

The second command should print the `.env` path, confirming Git ignores it. Do not commit local credentials, keys, database dumps or backups. `COOKIE_SECURE=false` is only for local HTTP; production needs HTTPS and secure cookies.

## 5. Create Initial Accounts

With the database and key configured, create the first Officer account from the repository root:

```powershell
php Biodiversity-Web/backend/bin/create-user.php officer@example.com "Local Officer" conservation_officer
```

Enter your chosen **12-72 byte password** at the prompt. Input may be visible, so use a private terminal. There is no default password. The first CLI-created account initializes the empty database's encryption key-check marker; do this before trying public registration.

Optional additional accounts:

```powershell
php Biodiversity-Web/backend/bin/create-user.php admin@example.com "Local Administrator" admin
php Biodiversity-Web/backend/bin/create-user.php botanist@example.com "Local Botanist" botanist
```

Use the Officer account for species management, review and officer workflows. Use Admin for user administration. Botanists do not automatically have Web management permissions. Public registration creates only General Users; it cannot create an Officer or Admin. Do not insert plaintext users directly in SQL: profiles and email lookup indexes must use the shared encryption helpers.

## 6. Start the Backend and Frontend

**Terminal A**, from the repository root:

```powershell
php -S localhost:8080 -t Biodiversity-Web/backend/public
```

Keep this terminal running. Only `backend/public` is served; never expose the whole backend directory.

**Terminal B**, from the repository root:

```powershell
cd Biodiversity-Web/Biodiversity-Website
npm ci
npm run dev
```

Open **http://localhost:5173** (login: **http://localhost:5173/#/login**) and sign in with the Officer email and password you created.

The frontend proxies `/api` and `/auth` to `http://localhost:8080`. Use `localhost` consistently rather than mixing it with `127.0.0.1`. Keep `APP_ORIGIN` equal to the frontend origin. Vite uses port 5173 with `strictPort`; it will fail rather than silently select another port.

If backend port 8080 is occupied, stop your own conflicting service or use another port:

```powershell
# Terminal A, repository root
php -S localhost:8091 -t Biodiversity-Web/backend/public
```

```powershell
# Terminal B, frontend directory, before starting Vite
$env:PHP_API_TARGET = 'http://localhost:8091'
npm run dev
```

Changing the backend port does not change `APP_ORIGIN`. If you deliberately change the frontend port, also update `APP_ORIGIN` and restart the services. Stop either development server with Ctrl+C in its terminal.

## 7. Verify the Setup

1. Confirm login works and logout returns you to login.
2. As Officer, create a fictional species, search for it, edit it, and test the photograph and report flows.
3. Check that review, distribution, monitoring, history and tracking pages open. A fresh database can legitimately show empty queues, maps, charts and lists; it does not contain a teammate's test data.
4. Use an Admin account if you need to manage users. An access-denied response for a role without permission is expected.

Optional frontend checks, from the frontend directory:

```powershell
npm run build
node --test tests/*.test.mjs
```

These checks do not replace database/browser acceptance tests. Automated integration fixtures require an explicitly isolated loopback `*_test` database; see [the security test plan](security/TEST_PLAN.md). Do not run fixtures against data you want to keep.

IoT pages can open without physical devices. Actual readings and automated alerts require valid device submissions and configured credentials. A new local database has no registered devices. Never put device secrets in frontend configuration; coordinate device integration using [tracking](TRACKING.md) and [monitoring](MONITORING.md) documentation. Mobile sync and physical-device verification remain separate integration work.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| `php`, `mysql`, `node` or `npm` is not recognized | Install the required tool or add its installation directory to the terminal PATH; XAMPP locations are shown above |
| `could not find driver` | Enable `pdo_mysql` in the PHP configuration used by the CLI; inspect `php --ini`, then restart PHP |
| Database connection refused / access denied | Start MySQL; check host, port, database, password and the matching database-user grants |
| Proxy error / backend unavailable | Keep Terminal A running; verify PHP's port matches `PHP_API_TARGET` or the default 8080 |
| Generic 500 during login or registration | Inspect the PHP terminal privately; verify schema, key path/permissions, matching key and first-account initialization or completed migration. Do not post credentials or sensitive logs |
| Key already exists | Preserve it; do not overwrite an active key. Reuse only if it belongs to this database, or choose a distinct private directory for a separate new database |
| Registration fails on an empty installation | First create an account through the CLI in section 5 to initialize the database key marker |
| 403 on writes / login | Use `localhost` consistently and check exact `APP_ORIGIN`; reload the login page to obtain a current CSRF token |
| Login returns 429 | Repeated failed attempts triggered throttling; wait for the indicated retry interval and use the correct account/password |
| Maintenance response (503) | Finish/verify the migration, then set `DATA_ENCRYPTION_MAINTENANCE=false` and restart PHP |
| Port 5173 is occupied | Stop your own previous frontend process or deliberately configure another port and update `APP_ORIGIN` |
| Empty maps/review/history | New databases contain no observations or sensor readings; this alone is not a setup error |

## 9. Existing Databases and Later Updates

Do not follow the fresh-database creation/import steps over an existing database. Back up the full database and preserve its matching key before upgrading. A Git pull updates code only; it does not migrate data.

For an older schema, inspect which changes are missing and apply only the corresponding SQL migrations 001-004 under `backend/migrations`, using a separate database operator account. Check existing indexes before applying 002/003. `CREATE TABLE IF NOT EXISTS` in the full schema does not upgrade old table definitions. Migration 005 is a CLI data migration, not an SQL file.

Before the encryption migration:

1. Stop all application writers, including old backend instances.
2. Configure the private key and encrypted snapshot directory. If the database is already encrypted, use its original key, including when importing another teammate's database copy; a new random key cannot decrypt it. Transfer matching keys only through an agreed secure channel, separately from Git.
3. Set `DATA_ENCRYPTION_MAINTENANCE=true` in the actual backend `.env`.
4. Use a private operator terminal for schema/migration privileges. Keep the `.env` runtime user restricted. For example, temporarily override database credentials only in this operator terminal:

   ```powershell
   $env:DB_USER = 'YOUR_DATABASE_OPERATOR'
   $operatorSecret = Read-Host 'Database operator password' -AsSecureString
   $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $operatorSecret).Password
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --apply
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   Remove-Item Env:DB_USER
   Remove-Item Env:DB_PASSWORD
   Remove-Variable operatorSecret
   ```

   Run each command in order and inspect its result. Initial `--check` returns 2 when migration is pending; the final check must return 0. If any migration step fails, keep maintenance mode enabled, clear temporary credentials, investigate and retry; do not reopen the app. The operator password exists temporarily in process memory/environment, so use a private terminal and do not print it.
5. After successful verification, set maintenance mode to `false`, start services with the restricted runtime account and verify login/business operations.

The migration preserves account IDs, password hashes, roles and relationships. Its encrypted sensitive-field snapshot is not a full database backup. Recovery, key handling and limitations are described in [DATA_PROTECTION.md](security/DATA_PROTECTION.md).

For subsequent updates, review migration notes first, pull `main` with local changes preserved, run `npm ci` in the frontend directory when dependencies change, and restart both services. Never replace a key merely because the code changed.

## Further Documentation

- [Backend configuration and authentication](backend/README.md)
- [Sensitive data, migration and recovery](security/DATA_PROTECTION.md)
- [Security test plan](security/TEST_PLAN.md)
- [Security test results](security/TEST_RESULTS.md)
- [Production deployment requirements](DEPLOYMENT.md)

This guide starts local development services only. It does not publish a public website or certify production security.
