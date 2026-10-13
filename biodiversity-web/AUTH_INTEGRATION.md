# Login and registration frontend handoff

## Added

- `/#/login`: email/password form with browser required/email validation.
- `/#/register`: full name, email, password and confirmation with matching-password and nonblank-name validation.
- Shared `PasswordField.vue` with accessible show/hide controls and autocomplete attributes.
- Shared `AuthLayout.vue`, responsive auth styling, dashboard links and explicit demo entry.
- Honest preview feedback: valid submissions do not sign in or create accounts. Password fields clear after a valid preview submission. No credentials are logged, persisted or sent.

The dashboard remains an openly accessible sample-data prototype. No frontend route guard, real session, role assignment or logout is implemented. Backend protection must be implemented before real data is used.

## Backend work requested

Connect the two view submit handlers to the team's authentication API. Confirm field names and response formats first. Eric's branch file listing includes `backend/public/auth/csrf.php`, `login.php`, `logout.php` and `me.php`, plus `backend/bin/create-user.php`; their contracts have not been verified here. The listing does not include a public registration endpoint. Coordinate registration or an account-approval flow with Eric rather than invoking the CLI from the browser.

1. Agree on registration fields and approval/role policy. Never trust a client-selected officer role.
2. Implement or confirm the registration endpoint, duplicate-email response and password policy. Eight characters is a temporary frontend minimum only.
3. Wire login with the agreed CSRF/session mechanism; use secure server-managed sessions. Do not store passwords in browser storage.
4. Add loading and network/server error states, prevent duplicate submissions, and show success only after the server confirms it.
5. Check sessions on load, add authenticated navigation and logout, and enforce officer permissions on backend endpoints.
6. Add integration tests for successful and rejected login, registration, expired sessions and unauthorized requests.

## Suggested pull request description

Adds frontend login and registration pages to the conservation officer Vue app, with shared password visibility controls, validation, responsive styling and navigation. Existing dashboard/species behavior is preserved.

Backend team: please connect the form handlers to authentication and provide/confirm a registration endpoint. This PR does not implement real authentication, account creation, session handling or role-based security. Demo access remains explicitly available.
