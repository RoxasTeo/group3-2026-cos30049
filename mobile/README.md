# Niah Biodiversity mobile app

Expo SDK 57, React Native, TypeScript and Expo Router.

## Run and edit

Open this `mobile` folder in Visual Studio Code, then run:

```powershell
npm.cmd install
npm.cmd run web
```

Use `npm.cmd start` for a device preview. GPS and photo capture need device permissions and should also be checked on a physical device.

## Integrated features

- Backend-connected login, role-based navigation and sign-out.
- Botanist Home: draft/pending counts and recent records from the shared session store; shortcuts to create, scan and browse records.
- Records: search/filter, details, create/edit/delete drafts, GPS tagging and photo attachments. Marking a complete draft ready puts it in Pending sync.
- Scan: manual plant-tag lookup opens an existing record or a new form. Native QR camera scanning is not installed yet.
- Profile: contributor's profile design, labelled demo account, session record count and a working Records shortcut.
- Sync: session-based status summaries, queue/failed/synced filters, record detail links and draft guidance. Upload controls remain disabled until cloud sync is connected.
- Conservation Officer feature tabs remain placeholders.

Start at `/navigation/botanist/home` to preview the integrated shell. Older `/plant-record/new` links redirect to `/plant/new`.

## Main files

- `src/app/`: Expo Router routes and layout.
- `src/screens/NavigationShell.tsx`: shared header, feature selection and bottom navigation.
- `src/screens/BotanistHomeScreen.tsx`: Home summary.
- `src/screens/ProfileScreen.tsx`: profile preview.
- `src/screens/RecordsScreen.tsx`: searchable record list.
- `src/data/plantRecords.ts`: shared session-only record store.
- `src/navigation/roles.ts`: menus for each role.
- `src/services/`: device capture and QR lookup adapters.

## Prototype limits

Login verifies accounts through the backend; navigation uses the returned role. Profile shows the signed-in account. Demo accounts remain fictional. Records include sample entries and live only in memory for the current session. Reloading resets them. There is no durable offline storage, server sync or scan-history store. Profile shows record count rather than an invented scan count.

See `RECORDS.md` for the Records workflow details.

## Checks

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:records
npx.cmd expo export --platform web
```


## Sign in with backend demo accounts

1. In backend, run `npm.cmd run demo:lan` for phone testing, or `npm.cmd run demo` for this computer only.
2. In mobile, run `npx.cmd expo start --clear`. Sign in from the root screen.
3. Use botanist@example.com, field.botanist@example.com, or officer@example.com with password NiahDemo2026!.

The API returns the role; Botanists open Botanist Home, officers open the officer shell
(feature tabs remain placeholders). Profile shows the current user. Sign out is available
above the tab bar. Login is required for navigation and plant routes; changing the URL role
does not change account privileges. Tokens remain in memory, expire after one hour, and
are cleared on reload/sign-out. Local field previews reset on sign-in/sign-out so account
switches do not expose the previous user's draft changes. These drafts are not durable.

By default, development uses the Expo computer hostname on port 3000. If needed, create
mobile/.env.local with EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_WIFI_IP:3000/api and
restart Expo. Use the computer's IP, not localhost, on a phone. Both devices need the same
Wi-Fi. Expo tunnel mode does not tunnel the backend; configure a reachable API separately.
For browser preview, its exact origin must appear in backend CORS_ORIGINS.
Production requires an explicit HTTPS API URL. Never put JWT_SECRET or database passwords
in mobile environment variables. API addresses are public configuration, not secrets.

Only authentication/profile are connected. The mobile record list and Sync remain local
UI previews, separate from the backend's six demo records.
