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

- Login form and role-based navigation preview.
- Botanist Home: draft/pending counts and recent records from the shared session store; shortcuts to create, scan and browse records.
- Records: search/filter, details, create/edit/delete drafts, GPS tagging and photo attachments. Marking a complete draft ready puts it in Pending sync.
- Scan: manual plant-tag lookup opens an existing record or a new form. Native QR camera scanning is not installed yet.
- Profile: contributor's profile design, labelled demo account, session record count and a working Records shortcut.
- Sync and Conservation Officer feature tabs remain placeholders.

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

Account information is sample data. Login and role URLs are UI previews, not authenticated access; backend authentication and authorization are still required. Records include sample entries and live only in memory for the current session. Reloading resets them. There is no durable offline storage, server sync or scan-history store. Profile shows record count rather than an invented scan count.

See `RECORDS.md` for the Records workflow details.

## Checks

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:records
npx.cmd expo export --platform web
```
