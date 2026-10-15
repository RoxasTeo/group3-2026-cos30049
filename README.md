# Niah Biodiversity System Web
### Group 3 · COS30049 Agile Software Development (2026)


Follow these sequential terminal commands strictly within your workspace root directory location to spin up your local development nodes:

### 1. Repository Setup & Dependency Isolation
Install all required Node engine distribution packages and dependencies tracked within your system configuration files:
```bash
npm install
npm run dev
```

### 2. Local Database Hydration
1. Open your MySQL client interface suite (e.g., **phpMyAdmin**).
2. Create a clean database target entry named `biodiversity_db`.
3. Import your project structural initialization blueprint schema layout data file directly into the storage target.
4. Ensure your project `config.php` or environment variables contain correct connection string properties matching your database user keys.

### 3. Spin Up Frontend Development Node
Boot up the internal Vite compiler engine utility to track live coding changes across your localized hot-reloading pipeline loops:
```bash
npm run dev
```
* Once initialized, open your browser and transition over to the local web host port displayed inside your console window (Typically: `http://localhost:5173`).

---

## 🧑‍🤝‍🧑 Account Privilege Role Permissions Matrix

The ecosystem implements strict backend structural authorization validation gates based on individual user profiles:

* **System Administrator (`admin`):** Complete execution rights over everything. Possesses explicit structural visibility to modify or suspend staff records inside the User Profile Management console.
* **Conservation Officer (`conservation_officer`):** Full dataset compilation privileges. Authorized to perform record insertions, content modifications, and row deletions across the core species registry.
* **Field Botanist (`botanist`):** No Access specialist profile.
* **General User (`user`):** Read-only explorer profile. Can view and filter park records inside a highly restricted, secure tabular view layout canvas.

---

## 💻 Integrated Terminal CLI Command Utilities

Provision pristine administrative or staff profiles privately without exposing text strings inside your public browser history tables using the native CLI creation command tools:

```bash
php backend/bin/create-user.php [email] "[Full Name]" [role]
```
* **Example Command String:** `php backend/bin/create-user.php admin@example.com "Test Admin" admin`
* *Note: The runtime terminal engine will safely capture parameters, prompt you for an account password under a blank masked line, hash it securely via `BCRYPT`, and write the profile directly to your database registries.*
