# Niah Biodiversity mobile app

Expo SDK 57, React Native, TypeScript and Expo Router. Edit this folder in Visual Studio Code.

**New teammate? Start with the [complete setup guide](../README.md).** It covers cloning, installing dependencies, creating environment files, initializing MySQL, seeding accounts, phone setup and troubleshooting. The instructions below assume first-time setup is complete.

## Start on your phone

1. In `backend`, run `npm.cmd run db:start` and keep the terminal open. In a second backend terminal run `npm.cmd run start:lan`. See `../backend/DATABASE.md`.
2. In `mobile`, run `npx.cmd expo start --clear` and scan its QR with a compatible Expo Go client. The Expo SDK and Expo Go version must match. Existing custom development builds must be rebuilt to include the newly installed native modules.
3. Keep your computer and phone on the same trusted Wi-Fi. Sign in with `botanist@example.com` / `NiahDemo2026!`.
4. Open Home → New plant record. Add observations, photos and GPS. Save a draft or mark it ready, then open Sync → Sync all records.

Development infers your computer's address from Expo; this checkout sets EXPO_PUBLIC_API_PORT=3001 for the shared MySQL API. Override with `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_WIFI_IP:3001/api` in `.env.local` if needed, then restart Expo. Phone localhost means the phone, not the computer. Expo tunnel does not tunnel the API. For browser preview use `npm.cmd run web` and include that browser origin in backend `CORS_ORIGINS`. Release builds require an explicit HTTPS API URL; never put database passwords or JWT secrets in mobile configuration.

Demo accounts: the first Botanist initially sees four samples, `field.botanist@example.com` sees two, and `officer@example.com` can access all six through the API. All use the development password above. New uploads increase those counts. Imported demo observations are labelled fictional. New submissions to MySQL are normal records; standalone demo mode labels all submissions fictional.

## Implemented Botanist workflow

- Login and role guards; native session credentials in SecureStore, browser session in sessionStorage.
- Home counts, recent records, scan and species-reference shortcuts.
- Create, edit and delete drafts; scientific name, family, height, morphology, conservation status, field observations and habitat notes.
- Camera/gallery attachments (up to four; JPEG/PNG/WebP up to 5 MB each) and foreground GPS with accuracy display.
- SQLite offline records on native; localStorage for browser preview. Native photos are copied into the app's document directory; browser photos are saved as data URLs. Full storage errors are surfaced without claiming the save succeeded.
- Offline sessions restore after restart. First sign-in requires a connection. Expired tokens allow local fieldwork but require signing out/in before uploading. Explicit logout hides account data and removes credentials; it does not erase saved records.
- Search and status filters. Account caches are separated by API address, user ID and email. Changing the API address uses a separate cache; return to the old address to access unsent records stored there.
- Sync uploads ready/failed records and photos, one at a time. Server-confirmed records become Synced; failed records retain an actionable error. Retry is explicit. An identical retry is safe after a lost response. Changed content under an existing ID is a conflict, never silently overwritten.
- Details generate a `plant:ID` QR tag. Camera scanning/manual entry opens a downloaded record or a new draft. Authorized users must download a record before opening it offline.
- Offline species reference under Home: three sourced starter entries with name/family/growth-form search, diagnostic notes, source links and a new-observation shortcut. Names can be prefilled, but observations are never fabricated.

The reference uses NParks Flora & Fauna Web summaries: [Bird’s nest fern](https://www.nparks.gov.sg/florafaunaweb/flora/1/5/1541), [Simpoh air](https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2847), [Elephant apple](https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2842). It is not a complete or verified Niah inventory. A botanist should validate and expand the dataset.

## Remaining deployment and acceptance work

The shared local API now uses MySQL; standalone SQLite demo mode remains available. A hosted central API/MySQL database, HTTPS configuration and real accounts are still needed for cloud deployment. Real MySQL integration tests verify uploads and authorized web-client reads. Conservation Officer feature tabs remain outside this Botanist workflow. There is no background sync, automatic species identification, server record editing, account recovery or officer approval workflow.

Saved local data is not a backup: uninstalling the app, clearing app/site storage or losing the device removes unsynced fieldwork. Browser storage capacity is smaller than native SQLite and may reject large photo collections. Removed local photo files are not automatically garbage-collected yet. Server images are resized to a maximum 1600 × 1600 bounding box and stored as JPEG data in the authenticated record; originals are not archived on the server.

## Checks

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:records
npx.cmd expo export --platform web
```

Phone acceptance checklist:

1. Sign in online; create a draft with a photograph and GPS.
2. Enable airplane mode, fully close/reopen the app; verify records, images, reference search and the draft remain available.
3. Add observations offline, mark ready, try Sync; verify it reports failure and retains the record.
4. Reconnect, sync/retry and verify Synced. Restart both the API and app; verify the record and photo still exist.
5. Open details and scan its QR using another authorized device after refreshing its records.
6. Test denied camera/GPS permissions, poor GPS accuracy, expired session, account switching and interrupted uploads.

Automated checks cannot substitute for these physical camera, GPS and native-storage checks.
