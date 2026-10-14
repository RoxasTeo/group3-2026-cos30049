# Authentication frontend integration

The login page connects to the PHP authentication module. Dashboard and species routes require an active Conservation Officer session. Species screens retain the existing sample records and localStorage behavior; this authentication-only change has no dependency on a species table or species API.

## Run locally

1. Start MySQL/MariaDB and create `biodiversity_db` if needed. Import only `backend/schema.sql` for this change. It creates `users` and `auth_login_attempts` without inserting accounts or changing species data.
2. Copy `backend/.env.example` to `backend/.env` and supply your database credentials. The database account needs SELECT/INSERT/UPDATE/DELETE on the authentication tables.
3. For local development, use `APP_ORIGIN=http://localhost:5173` and `COOKIE_SECURE=false`.
4. From the repository root, provision a test account:

   ```powershell
   C:/xampp/php/php.exe backend/bin/create-user.php officer@example.com "Test Officer" conservation_officer
   ```

   Enter a unique password of 12-72 bytes on standard input. Terminal input may be visible.
5. Start PHP:

   ```powershell
   C:/xampp/php/php.exe -S 127.0.0.1:8080 -t backend/public
   ```

6. In another terminal:

   ```powershell
   cd biodiversity-web
   npm install
   npm run dev
   ```

7. Visit `http://localhost:5173/#/login`. Use this hostname consistently. Vite proxies `/auth/` to PHP on port 8080; `PHP_API_TARGET` can override that target.

## Files and behavior

- `src/services/authService.js`: login, session retrieval and logout. Uses cookies and CSRF tokens; passwords, user identities and tokens are never persisted in browser storage.
- `src/router/index.js`: route definitions and guards moved from main.js. Protected navigation checks `/auth/me.php`. Non-officers see access restricted; unauthenticated users are redirected to login.
- `src/App.vue`: actual user name, logout and session rechecks on window focus. No species API calls. The sample-data notice remains visible.
- Login includes loading/error states and prevents duplicate submissions. Logout reports success only after the server confirms the session has ended.
- `/register` provides administrator account-request instructions. No public registration endpoint is present.
- The species form permits navigation to authentication pages when the session ends, so its unsaved-change prompt cannot block logout or access restriction. Its demo save behavior is otherwise unchanged.

Serve only `backend/public` through PHP. In production, route `/auth/` to PHP and serve the Vue build through your web server, with HTTPS and secure cookies. `vite preview` alone does not proxy PHP.

## Validation and remaining integration

Check rejected/correct login, direct protected links, reload, logout, non-officer rejection, cross-tab session invalidation, server/network errors and account-request guidance. Dashboard and demo species pages must load without species tables/endpoints or any `/Species_` request.

The local test harness remains outside the staged submission. SCRUM-29 remains responsible for plant API integration. Replacing sample storage with real plant APIs is a separate change requiring backend role and CSRF guards; frontend navigation checks alone do not protect future database endpoints.
