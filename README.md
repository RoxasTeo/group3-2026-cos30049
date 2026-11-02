# Niah Biodiversity System

Integrated Web and mobile workspace for local development. Both clients use one PHP backend and MySQL database. Hardware firmware and cloud deployment are separate work.

> **Pulled the November 2026 mobile/PHP integration?** Run `powershell -ExecutionPolicy Bypass -File .\setup-local.ps1 -Demo` once (step-by-step guide and demo accounts in [TEAM_UPGRADE.md](TEAM_UPGRADE.md)): it adds the required encryption key, database and migrations, plus demo accounts and sample data. New teammates can use the same script.

## Layout

- `Biodiversity-Web/Biodiversity-Website`: Vue frontend.
- `Biodiversity-Web/backend`: PHP API (Web session API and `/api/mobile` token API), MySQL schema and migrations.
- `mobile`: Expo/React Native Botanist field app — QR tags, offline records, photos, GPS and sync to the shared backend. See [mobile/README.md](mobile/README.md).

Includes species/photo management, knowledge search, observation review, distribution maps, CSV/PDF reports, role-based accounts, sensor monitoring, historical trends, automatic threat detection and individual plant/device tracking.

## Run locally

**Start here:** [Complete Web Setup Guide](Biodiversity-Web/SETUP.md) covers prerequisites, a fresh database, initial accounts, both development servers, troubleshooting and existing-database upgrades.

Prerequisites: Node matching the frontend engines requirement, PHP 8.1+ with PDO MySQL and image support, and MySQL/MariaDB using InnoDB.

1. Create a database. For a fresh installation import `Biodiversity-Web/backend/schema.sql` into it. For existing installations back up first, apply only missing migrations 001–004, 006 and 007, then run the one-time field-encryption migration ([SETUP section 9](Biodiversity-Web/SETUP.md#9-existing-databases-and-later-updates)). Do not import test fixtures into a real database.
2. Generate a private encryption key outside the repository ([SETUP section 3](Biodiversity-Web/SETUP.md#3-generate-a-private-encryption-key)); names, emails and field/review notes are stored encrypted. Copy `Biodiversity-Web/backend/.env.example` to `Biodiversity-Web/backend/.env`. Set DB credentials, `DATA_ENCRYPTION_KEY_FILE`, `APP_ORIGIN=http://localhost:5173` and `COOKIE_SECURE=false` for local HTTP. Environment variables override this file. Keep `.env` private.
3. Provision an officer with `php Biodiversity-Web/backend/bin/create-user.php officer@example.com "Test Officer" conservation_officer`. Enter a unique 12–72 byte password on standard input. Public registration provisions only General Users.
4. From the repository root start PHP:

   ```sh
   php -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public
   ```

5. In another terminal start the frontend:

   ```sh
   cd Biodiversity-Web/Biodiversity-Website
   npm ci
   npm run dev
   ```

Open `http://localhost:5173`. Keep frontend and PHP on the same hostname. For the mobile app, follow [mobile/README.md](mobile/README.md); it reaches this same PHP server on port 8080. Vite proxies to PHP port 8080; set `PHP_API_TARGET` when using another port. Never put device keys in frontend configuration.

## Feature documentation

From the frontend directory, run `npm run build` to create a production build.

- [Observation review](Biodiversity-Web/Biodiversity-Website/OBSERVATION_REVIEW.md)
- [Species distribution](Biodiversity-Web/Biodiversity-Website/SPECIES_DISTRIBUTION.md)
- [Biodiversity reports](Biodiversity-Web/Biodiversity-Website/REPORTS.md)
- [Monitoring, history and automatic alerts](Biodiversity-Web/MONITORING.md)
- [Individual plant/device tracking](Biodiversity-Web/TRACKING.md)
- [Deployment requirements](Biodiversity-Web/DEPLOYMENT.md)

## Integration sources

Baseline: `RoxasTeo/Biodiversity-Web` (`ad9926a`), including species backend and authentication/UI integration. Reports: `bryan/biodiversity-reports` (`6ad8d48`); `bryan/next-feature` has the same tree. Additional review, maps, security, monitoring and tracking were developed in `eric/web-observation-review`. Mobile app: `qiwei/mobile-login&navigation` (`b345efc`), connected to the PHP backend in place of its separate Node.js API. Older Web layouts are not duplicated as separate applications.

Application code, example configuration, migrations, documentation are included. Dependencies, build output, real credentials and local database files are excluded. Local integration does not push or deploy the application.
