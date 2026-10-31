# Web Setup Guide (Local Development)

This guide takes a teammate from pulling `main` to logging in to the Web application. It covers the Vue frontend, PHP backend, local database and initial accounts. Mobile setup, physical IoT devices and production deployment are separate tasks.

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

**Choose the correct database path:** Sections 2-6 are for a new, empty local database. If you already have project data, use section 9 instead. Pulling Git does not download another teammate's database, accounts or passwords.

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

## 3. Sensitive-Field Encryption Is Deferred

No encryption key is required for a fresh installation. Web/Mobile field encryption will be designed together later. Passwords remain bcrypt hashes; names, emails and observation/review text currently use the original database format.

If your database was encrypted by migration 005, stop here and follow [the rollback guide](#appendix-previously-encrypted-databases) using the original key before starting this version. Do not generate a replacement key or recreate accounts.

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
```

Use your actual database port. The `.env` loader expects plain `KEY=value` entries, without quotes, variable substitution or inline comments. Environment variables override the file; clear stale database overrides if they refer to another setup.

Restrict access to `.env` to the runtime Windows user and SYSTEM:

```powershell
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls Biodiversity-Web/backend/.env /inheritance:r /grant:r "${currentIdentity}:F" '*S-1-5-18:F'
git check-ignore Biodiversity-Web/backend/.env
```

The final command should print the ignored path. Do not commit credentials or database dumps. `COOKIE_SECURE=false` is for local HTTP only; production needs HTTPS and secure cookies.

## 5. Create Initial Accounts

With the database configured, create the first Officer account from the repository root:

```powershell
php Biodiversity-Web/backend/bin/create-user.php officer@example.com "Local Officer" conservation_officer
```

Enter your chosen **12-72 byte password** at the prompt. Input may be visible, so use a private terminal. There is no default password. You can create an Officer through the CLI; public registration creates only General Users.

Optional additional accounts:

```powershell
php Biodiversity-Web/backend/bin/create-user.php admin@example.com "Local Administrator" admin
php Biodiversity-Web/backend/bin/create-user.php botanist@example.com "Local Botanist" botanist
```

Use the Officer account for species management, review and officer workflows. Use Admin for user administration. Botanists do not automatically have Web management permissions. Public registration creates only General Users; it cannot create an Officer or Admin. Use the CLI or administration UI to create privileged accounts so password hashing and validation are applied.

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
```

The shared branch contains application code and setup documentation; local test scripts and test reports are excluded.

IoT pages can open without physical devices. Actual readings and automated alerts require valid device submissions and configured credentials. A new local database has no registered devices. Never put device secrets in frontend configuration; coordinate device integration using [tracking](TRACKING.md) and [monitoring](MONITORING.md) documentation. Mobile sync and physical-device verification remain separate integration work.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| `php`, `mysql`, `node` or `npm` is not recognized | Install the required tool or add its installation directory to the terminal PATH; XAMPP locations are shown above |
| `could not find driver` | Enable `pdo_mysql` in the PHP configuration used by the CLI; inspect `php --ini`, then restart PHP |
| Database connection refused / access denied | Start MySQL; check host, port, database, password and the matching database-user grants |
| Proxy error / backend unavailable | Keep Terminal A running; verify PHP's port matches `PHP_API_TARGET` or the default 8080 |
| Generic 500 during login or registration | Inspect the PHP terminal privately; verify database credentials and schema; previously encrypted databases must complete the rollback first. Do not post credentials or sensitive logs |
| 403 on writes / login | Use `localhost` consistently and check exact `APP_ORIGIN`; reload the login page to obtain a current CSRF token |
| Login returns 429 | Repeated failed attempts triggered throttling; wait for the indicated retry interval and use the correct account/password |
| Port 5173 is occupied | Stop your own previous frontend process or deliberately configure another port and update `APP_ORIGIN` |
| Empty maps/review/history | New databases contain no observations or sensor readings; this alone is not a setup error |

## 9. Existing Databases and Later Updates

Do not create/import a fresh database over existing data. Back up the complete database first. Pulling Git updates code only and does not migrate records.

If migration 005 encryption was already applied, stop all writers and follow [the rollback guide](#appendix-previously-encrypted-databases), using the original matching key. The normal application no longer decrypts those fields. Keep the private key and old backups for recovery; they are not required by the converted runtime.

For an older unencrypted schema, inspect missing changes and apply only the corresponding SQL migrations 001-004 under `backend/migrations`, using a separate database operator account. Check existing indexes before applying 002/003. Do not run the former encryption migration 005. `CREATE TABLE IF NOT EXISTS` does not upgrade existing table definitions.

For later updates, preserve local changes, pull `main`, read migration notes, run `npm ci` in the frontend directory when dependencies change, and restart both services. Keep the normal runtime database account restricted to data access.

## Further Documentation

- [Backend configuration and authentication](backend/README.md)
- [Production deployment requirements](DEPLOYMENT.md)

This guide starts local development services only. It does not publish a public website or certify production security.

## Appendix: Previously Encrypted Databases

Do not simply switch code or generate a replacement key: this version expects the original field format. Convert the existing database using its matching original key first. Preserve IDs, password hashes, roles, decisions and relationships; do not recreate accounts or delete observations to bypass migration.

1. Stop **all** backend instances and other writers. The current runtime no longer has the old encryption maintenance gate; setting a variable alone does not stop services.
2. Back up the complete database to a restricted directory outside Git. Keep the original key and old encrypted snapshots. The rollback tool also creates and verifies a private encrypted sensitive-field snapshot, but this is not a full backup.
3. Retain these settings in the local, ignored backend `.env` for the operator tool only:

   ```dotenv
   DATA_ENCRYPTION_KEY_FILE=C:/private/path/to/original/data.key
   DATA_ENCRYPTION_BACKUP_DIR=C:/private/path/to/backups
   DATA_ENCRYPTION_MAINTENANCE=true
   ```

   Paths must be absolute and outside every Git working tree. Do not overwrite an existing key or expose credentials. The normal Web runtime ignores these settings and does not load the legacy cipher helper.
4. In a private PowerShell terminal at the repository root, temporarily use a database operator account with schema privileges. Keep the ordinary `.env` runtime account restricted:

   ```powershell
   $env:DB_USER = 'YOUR_DATABASE_OPERATOR'
   $operatorSecret = Read-Host 'Database operator password' -AsSecureString
   $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $operatorSecret).Password
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --check
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --apply
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --check
   Remove-Item Env:DB_USER
   Remove-Item Env:DB_PASSWORD
   Remove-Variable operatorSecret
   ```

   Run one command at a time and inspect its result. The initial check returns 2 when a verified conversion is pending; the final check must return 0. If any command fails, stop, clear temporary credentials, investigate and keep all writers offline. Do not start the unencrypted application against remaining ciphertext.
5. The tool authenticates encrypted fields using the original key, verifies the private encrypted snapshot before writes, converts protected fields, restores VARCHAR user fields and the unique plaintext email index, and removes `email_lookup`/`data_protection_state`. Old keyed login-attempt counters are cleared once. IDs, password hashes and business relationships are preserved.
6. MySQL schema changes are not fully transactional with field updates. If the schema stage fails, keep writers stopped and rerun with the original key after investigating. The tool accepts already-converted fields for retry, but never treats invalid ciphertext as plaintext. Restore the full pre-conversion backup with its matching code/key if recovery is needed.
7. After the final check passes, set `DATA_ENCRYPTION_MAINTENANCE=false`, clear operator overrides and start the normal services. Verify existing login, registration, review, reports and maps. Keep the old private key and backups until recovery requirements have been resolved; do not commit or automatically delete them.

`backend/bin/legacy-field-encryption.php` is CLI-only compatibility code for this rollback. It is not required by Web requests and does not enable field encryption. Encryption-generation, apply and encrypted restore commands have been removed from the active setup.
