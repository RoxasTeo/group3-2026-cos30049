# Niah Biodiversity System — Web

Integrated Web workspace for local development. Mobile remains on its own branches. Hardware and cloud deployment are separate work.

## Layout

- `Biodiversity-Web/Biodiversity-Website`: Vue frontend.
- `Biodiversity-Web/backend`: PHP API, MySQL schema and migrations.

Includes species/photo management, knowledge search, observation review, distribution maps, CSV/PDF reports, role-based accounts, sensor monitoring, historical trends, automatic threat detection and individual plant/device tracking.

## Run locally

**Start here:** [Complete Web Setup Guide](Biodiversity-Web/SETUP.md) covers prerequisites, a fresh database, private encryption keys, initial accounts, both development servers, troubleshooting and existing-database upgrades.

Prerequisites: Node matching the frontend engines requirement, PHP 8.1+ with PDO MySQL and image support, and MySQL/MariaDB using InnoDB.

1. Create a database. For a fresh installation import `Biodiversity-Web/backend/schema.sql` into it. For existing installations back up first and apply only missing migrations 001–005; inspect existing indexes before applying 002/003. Do not import test fixtures into a real database.
2. Copy `Biodiversity-Web/backend/.env.example` to `Biodiversity-Web/backend/.env`. First generate/configure the private encryption key outside Git as described in `Biodiversity-Web/security/DATA_PROTECTION.md`. Migration 005 is a CLI data migration, not SQL-only. Set DB credentials, `APP_ORIGIN=http://localhost:5173` and `COOKIE_SECURE=false` for local HTTP. Environment variables override this file. Keep `.env` private.
3. Provision an officer with `php Biodiversity-Web/backend/bin/create-user.php officer@example.com "Test Officer" conservation_officer`. Enter a unique 12–72 byte password on standard input. Public registration provisions only General Users.
4. From the repository root start PHP:

   ```sh
   php -S localhost:8080 -t Biodiversity-Web/backend/public
   ```

5. In another terminal start the frontend:

   ```sh
   cd Biodiversity-Web/Biodiversity-Website
   npm ci
   npm run dev
   ```

Open `http://localhost:5173`. Keep frontend and PHP on the same hostname. Vite proxies to PHP port 8080; set `PHP_API_TARGET` when using another port. Never put device keys in frontend configuration.

## Validation and feature documentation

From the frontend directory run `npm run build` and `node --test tests/*.test.mjs`. Database/browser tests require explicit disposable local `*_test` settings, as documented below. They create fictional records and must never target production.

- [Sensitive data protection](Biodiversity-Web/security/DATA_PROTECTION.md)
- [Security test plan](Biodiversity-Web/security/TEST_PLAN.md)
- [Security reassessment results](Biodiversity-Web/security/TEST_RESULTS.md)
- [Web acceptance and security](Biodiversity-Web/WEB_ACCEPTANCE.md)
- [Observation review](Biodiversity-Web/Biodiversity-Website/OBSERVATION_REVIEW.md)
- [Species distribution](Biodiversity-Web/Biodiversity-Website/SPECIES_DISTRIBUTION.md)
- [Biodiversity reports](Biodiversity-Web/Biodiversity-Website/REPORTS.md)
- [Monitoring, history and automatic alerts](Biodiversity-Web/MONITORING.md)
- [Individual plant/device tracking](Biodiversity-Web/TRACKING.md)
- [Deployment requirements](Biodiversity-Web/DEPLOYMENT.md)

## Integration sources

Baseline: `RoxasTeo/Biodiversity-Web` (`ad9926a`), including species backend and authentication/UI integration. Reports: `bryan/biodiversity-reports` (`6ad8d48`); `bryan/next-feature` has the same tree. Additional review, maps, security, monitoring and tracking were developed in `eric/web-observation-review`. Older Web layouts are not duplicated as separate applications.

Application code, example configuration, migrations, documentation and guarded test tools are included. Dependencies, build output, real credentials and local database files are excluded. Local integration does not push or deploy the application.
