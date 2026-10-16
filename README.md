# Niah Biodiversity System
### Group 3 · COS30049 Agile Software Development (2026)

A secure, decoupled web application engineered for tracking, managing, and auditing flora species registries inside Niah National Park. This system features a reactive **Vue 3 SPA frontend** and a secure, framework-aligned **PHP / PDO database API backend**.

---

## System Prerequisites

Before initiating local installation passes, ensure your machine satisfies the following environment configuration constraints:
* **Node.js** (v18.0.0 or higher) & **npm** (v9.0.0 or higher)
* **PHP Runtime Environment** (v8.1.0 or higher)
* **PHP Extensions Active:** `pdo_mysql`, `session`, `json`, `filter`, `openssl`
* **MySQL Database Server** (v8.0 or MariaDB equivalent running locally on port `3306`)
* **Local Web Server Wrapper** (Apache or standard built-in PHP CLI wrapper)

---

## Step 1: Backend Database Architecture Setup

1. Launch your preferred MySQL management interface tool (e.g., **phpMyAdmin**).
2. Create a clean database target entry named **`biodiversity_db`** configured with `utf8mb4_general_ci` character encoding rules.
3. Import the system baseline schema configuration directly by executing the database blueprint script found inside **`backend/schema.sql`** via a database administrator tool. This creates the users and login-attempt tables safely without replacing pre-existing data.
4. Create a dedicated application database user with `SELECT`, `INSERT`, `UPDATE`, and `DELETE` privileges on the authentication tables. Do **not** use the MySQL root account in deployment.
5. Ensure your table structure uses the **InnoDB engine** natively to support proper transaction constraints and locking behavior guarantees.

---

## Step 2: Backend Environment Configuration Setup

1. Copy `.env.example` to `.env` in your root workspace path directory.
2. Supply your local instance configuration credentials:
   ```ini
   DB_HOST=127.0.0.1
   DB_NAME=biodiversity_db
   DB_USER=biodiversity_app
   DB_PASSWORD=your_secure_password
   COOKIE_SECURE=false
   APP_ORIGIN=http://localhost:5173
   ```
   *Note: Set `COOKIE_SECURE=false` strictly for local HTTP development loops. Production environments require full HTTPS and `COOKIE_SECURE=true`.*

3. **Provision Staff & Privileged Administration Profiles via CLI Terminal:**
   Open a system command line prompt window, navigate to your workspace repository root, and generate your initialization accounts natively:
   ```sh
   php backend/bin/create-user.php officer@example.com "Test Officer" conservation_officer
   php backend/bin/create-user.php botanist@example.com "Test Botanist" botanist
   php backend/bin/create-user.php admin@example.com "System Admin" admin
   ```
   *Note: Provide a unique 12-72 byte password when prompted on standard input (`STDIN`). Terminal input might be visible. Passwords will be cryptographically hashed via `BCRYPT` and never stored as plaintext.*

4. **Spin Up Local Backend Testing Port Instance:**
   Serve **only `backend/public`** as your public web root directory using the standard local PHP CLI server wrapper:
   ```sh
   php -S localhost:8080 -t backend/public
   ```
   *Always ensure you use matching hostnames for Vue and PHP (both `localhost`, not mixing `127.0.0.1` and `localhost`) to maintain SameSite cookie integrity.*

---

## Step 3: Frontend Interface Setup & Local Deployment

Follow these sequential commands within your project repository folder root to initialize the single-page application:

### 1. Install Node Engine Distribution Packages
Download and isolate every structural dependency tracked inside the application's configuration package definitions manifests:
```bash
npm install
```

### 2. Spin Up Frontend Development Node Server
Boot up the tracking dev server using hot-reloading pipeline watchers:
```bash
npm run dev
```

### 3. **Access the Application Workspace:**
   Once the console compiles successfully, launch a clean web browser window and open the output address URL: **`http://localhost:5173`**

---

## 🧑‍🤝‍🧑 Account Privilege Role Permissions Matrix

The ecosystem implements strict backend structural authorization validation gates based on individual user profiles:

* **System Administrator (`admin`):** Complete execution rights over everything. Possesses explicit structural visibility to modify, create, or toggle staff records inside the User Profile Management dashboard view page. Profile Management is located by clicking on Admin Profile.
* **Conservation Officer (`conservation_officer`):** Full dataset compilation privileges. Authorized to perform record insertions, content modifications, and row deletions across the core species registry panels.
* **Field Botanist (`botanist`):** No specialist profile. No Accesses full overview dashboards and taxonomic description sheets but is strictly blocked from making data mutations or touching web management systems.
* **General User (`user`):** Read-only explorer profile. Can view and filter park records inside a highly restricted, secure tabular view layout canvas.

---

## 🏁 Mandatory Acceptance Integration Checks

Validate that the full integration cycle conforms to requirements by confirming the following checks pass cleanly:
1. **CSRF Rotation:** Fetching a token before login via `/auth/csrf.php` sets up an anonymous session. Correct login rotates both the Session ID and token, and excludes password hashes from the return payload object.
2. **Brute-Force Throttling:** Five sequential failures per normalized email within 15 minutes block further attempts across browser sessions, returning an HTTP `429 Too Many Requests` status along with a `Retry-After` header tracking the remaining delay.
3. **Guard Real-Time Reaction:** Disabling an account or modifying their role string directly inside the database takes effect immediately on the next guarded request, blocking or re-routing them without requiring token drops.
