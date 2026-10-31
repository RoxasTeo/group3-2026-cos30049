# Web authentication (SCRUM-32)

Sensitive fields now require a private encryption key and operator data migration before using existing accounts. Follow `../security/DATA_PROTECTION.md` before account provisioning. API responses retain their original format; SQL integrations must use `email_lookup` and the shared encryption helpers rather than querying plaintext email. Passwords remain bcrypt hashes.

PHP 8.1+ with PDO MySQL and MySQL/MariaDB. Serve **only `backend/public`** as the web root. Public registration provisions only the General User role. Officers and botanists are provisioned by an administrator; clients cannot select a privileged role during registration.

## Setup

1. Create `biodiversity_db` if it does not exist; import `backend/schema.sql` using a database administrator. This creates the users and login-attempt tables without inserting accounts or replacing existing data. Existing authentication tables must use InnoDB for the transaction/locking guarantees.
2. Create a dedicated application database user with SELECT/INSERT/UPDATE/DELETE on the authentication tables. Business endpoints may require additional grants. Do not use the MySQL root account in deployment.
3. Copy `.env.example` to `.env` in this directory and supply credentials. The optional loader accepts plain `KEY=value` entries (no quoting or interpolation). Environment variables override the file.
4. Provision accounts from the repository root:

   ```sh
   php backend/bin/create-user.php officer@example.com "Test Officer" conservation_officer
   php backend/bin/create-user.php botanist@example.com "Test Botanist" botanist
   ```

   Enter a unique 12-72 byte password on standard input; terminal input may be visible. Passwords are hashed with bcrypt, never stored as plaintext. The byte limit prevents bcrypt truncation.
5. For local development: `php -S localhost:8080 -t backend/public`. Set `COOKIE_SECURE=false` only for local HTTP. Production requires HTTPS and `COOKIE_SECURE=true`.

Use the same hostname for Vue and PHP (both `localhost`, not one `127.0.0.1`). This configuration expects a same-site deployment, with the exact Vue origin in `APP_ORIGIN`. Cross-site hosting requires a separate cookie and CSRF configuration review.

## API contract

All responses are JSON and use `Cache-Control: no-store`. All browser requests use `credentials: 'include'`.

| Method | Path | Result |
| --- | --- | --- |
| GET | /auth/csrf.php | `{ "csrf_token": "..." }`, creates anonymous session |
| POST | /auth/login.php | JSON email/password; returns user and rotated CSRF token |
| GET | /auth/me.php | Current user and CSRF token, or 401 |
| POST | /auth/logout.php | Destroys server session and expires cookie |

For every POST, send `X-CSRF-Token` from the latest response. Login requires `Content-Type: application/json`. Fetch a CSRF token before login; replace it with the token returned after successful login. User objects contain `id`, `name`, `email`, and `role`; never a password hash. Ignore client-side role claims.

Errors: 400 malformed input, 401 invalid credentials/missing or expired session, 403 invalid CSRF/origin/role, 405 wrong method, 413 oversized input, 415 wrong content type, 429 rate limit, 500 generic server error. Login errors do not distinguish unknown accounts, disabled accounts, and wrong passwords. Five failures per normalized email within 15 minutes block further attempts until the window expires; `Retry-After` provides the delay. Periodically delete throttle rows older than a day using an operator job. Account-based limits can be used to temporarily deny another user's login; add edge/IP throttling for production.

Idle timeout defaults to 30 minutes; absolute lifetime defaults to eight hours. Both must be positive integers in seconds. Login regenerates the Session ID. Each protected request reloads the account, so disabling a user or changing their role takes effect immediately. Existing sessions issued before this implementation must log in again.

## Integrating SCRUM-29

This change delivers the authentication module. The species API owner should connect their endpoints to the shared bootstrap and guards. Serve authentication and business endpoints from the same PHP service with consistent session settings. For an endpoint under `backend/public`, use:

```php
<?php
require_once __DIR__ . '/../bootstrap.php';
api(['POST']); // use the agreed method for this endpoint
$user = requireRole(['conservation_officer']);
requireCsrf();
// Validate input, then perform the existing species operation.
```

`$_SESSION['user_id']` remains compatible with the original species endpoints. Checking that field alone is insufficient: use the shared guard to enforce expiry, active account status, and roles. Replace the endpoint's existing session/CORS initialization with `api()` rather than starting a second session. `database()` returns PDO; existing mysqli queries need adapting or a separately configured mysqli connection. All browser writes must send the latest CSRF token and use `credentials: 'include'`.

`jsonBody()` defaults to an 8 KiB limit for authentication requests. Photo-bearing business endpoints can specify a suitable explicit limit, for example `jsonBody(4 * 1024 * 1024)`, and must validate their own fields and photo size. Initialize schemas through an operator migration rather than a public route.

The minimum policy grants species management to `conservation_officer`. `botanist` is for field submissions and has no implied web management permission. `admin` is provisionable but has **no automatic bypass**: explicitly agree and list allowed roles per endpoint. The project scope's references to trainers/guides differ from its botanical roles and require team clarification.

Vue integration: add a login screen, load `/auth/me.php` on application startup, redirect 401 responses to login, show 403 as access denied, and clear local user state after logout. Route guards improve navigation; backend guards enforce security. The current Web workspace uses the shared PHP species API and database. The old sample repository is no longer imported by the live application shell.

## Acceptance checks

With a dedicated test database and two provisioned roles:

1. Get CSRF token; correct login succeeds, rotates Session ID and token, and returns no hash.
2. Wrong password, unknown user, and disabled user return the same 401 message.
3. Five failed attempts cause the next attempt to return 429, including attempts using fresh browser sessions.
4. Missing/incorrect CSRF and unapproved Origin return 403; malformed JSON returns 400.
5. `/auth/me.php` before login and after logout returns 401.
6. Officer passes a guarded species endpoint; botanist receives 403, including direct HTTP requests.
7. Set short positive timeout values in the test environment; idle and absolute expiry both deny access.
8. Disable a logged-in user or change their role in the test database; the next guarded request enforces the change.
9. Confirm production Cookie flags and check that `.env`, SQL, and CLI scripts are not served.

Run syntax checks with `php -l` on every PHP file. These checks alone do not establish working database authentication. Record integration results and later vulnerability assessment/reassessment evidence for the project SSDLC deliverables.

Local validation completed using an isolated MySQL instance and local species adapters: correct/incorrect/unknown/disabled login, Session ID rotation, throttling across browser sessions, officer CRUD, botanist denial, role/status changes, logout, and idle/absolute expiry. Fifteen database-independent HTTP checks covered cookie flags, method/origin/content-type restrictions, malformed/oversized JSON, and CSRF. The local test harness and species adapters are excluded from this authentication-only change. The checklist above supports verification by teammates; browser UI integration and HTTPS deployment remain separate checks.


See `../WEB_ACCEPTANCE.md` for the integrated non-IoT acceptance and security results, and `../DEPLOYMENT.md` for production requirements and checks.
