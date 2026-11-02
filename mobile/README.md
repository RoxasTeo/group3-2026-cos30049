# Niah Biodiversity mobile app

Expo SDK 58, React Native, TypeScript and Expo Router. Edit this folder in Visual Studio Code.

The app uses the **same PHP backend and MySQL database as the Web portal** (`../Biodiversity-Web/backend`). Botanist uploads become observations in the Web review queue, appear on species distribution maps once approved, and the app's species reference is the Web knowledge system. Set up the backend first with [`../Biodiversity-Web/SETUP.md`](../Biodiversity-Web/SETUP.md), including migration `006_mobile_api.sql` on an existing database.

## Start on your phone

1. Start MySQL, then serve the backend on all interfaces so the phone can reach it:
   ```powershell
   php -S 0.0.0.0:8080 -t Biodiversity-Web/backend/public
   ```
   Plain PHP installs default to `post_max_size=8M`; photo uploads need about 30 MB (`php -d post_max_size=32M -S ...`). XAMPP already allows 40 MB.
2. In `mobile`, run `npm ci`, then `npx.cmd expo start --clear` and scan its QR with a compatible Expo Go client. The Expo SDK and Expo Go version must match.
3. Keep your computer and phone on the same trusted Wi-Fi. Sign in with a `botanist` or `conservation_officer` account created with `Biodiversity-Web/backend/bin/create-user.php`. Admin and public accounts use the Web portal.
4. Open Home → New plant record. Add observations, photos and GPS. Save a draft or mark it ready, then open Sync → Sync all records.

Development infers your computer's address from Expo and uses port 8080. Override with `EXPO_PUBLIC_API_PORT`, or `EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_WIFI_IP:8080/api` in `.env.local`, then restart Expo. Phone localhost means the phone, not the computer. Expo tunnel does not tunnel the API. For browser preview (`npm.cmd run web`) add the Expo origin, e.g. `http://localhost:8081`, to `MOBILE_WEB_ORIGINS` in the backend `.env`. Release builds require an explicit HTTPS API URL; never put database passwords or device keys in mobile configuration.

## Implemented workflow

Botanist:

- Sign-in with a bearer token from `/api/mobile/login.php` (12 hours by default, `MOBILE_TOKEN_SECONDS`). Only a SHA-256 hash is stored on the server; the device keeps the token in SecureStore. Signing out revokes it on the server.
- Home counts, recent records, scan and species-reference shortcuts.
- Create, edit and delete drafts; scientific name, family, height, morphology, conservation status, field observations and habitat notes.
- Camera/gallery attachments (up to four; JPEG/PNG/WebP up to 5 MB each) and foreground GPS with accuracy display.
- SQLite offline records on native; localStorage for browser preview. Full storage errors are surfaced without claiming the save succeeded.
- On-device encryption: offline records (GPS, notes, identifications) and saved photos are encrypted with AES-256-GCM using a random per-installation key kept only in the platform keychain (SecureStore). Records saved by earlier versions are re-encrypted on first open. Browser previews have no keychain and are not encrypted.
- Offline sessions restore after restart. First sign-in requires a connection. Expired tokens allow local fieldwork but require signing out/in before uploading.
- Sync uploads ready/failed records and photos one at a time to `/api/mobile/plants.php`. The plant ID is the client reference, so a retry after a lost response returns the stored record rather than a duplicate. A scientific name matching a knowledge-system species links the observation to it automatically.
- Synced records show the officer's review decision (Pending, Changes requested, Approved, Rejected) and reviewer notes. Photos of records synced from another device are downloaded with the account token.
- Details generate a `plant:ID` QR tag. Camera scanning/manual entry opens a downloaded record or a new draft.
- Species reference: the Web knowledge system's species (taxonomy, conservation status, description, habitat, ecology, cultural significance), cached on the device for offline search, with a shortcut to start an observation prefilled from a species.

Conservation Officer: Home explains the Web portal workflow; Species opens the same offline species reference. Reviewing observations, editing species and exporting reports are done on the Web portal.

## Remaining deployment and acceptance work

A hosted HTTPS backend, cloud MySQL and real accounts are still needed for cloud deployment. There is no background sync, automatic species identification or editing of records after upload; a botanist asked for changes records a corrected observation under a new plant ID.

Saved local data is not a backup: uninstalling the app, clearing app/site storage or losing the device removes unsynced fieldwork. Browser storage capacity is smaller than native SQLite and may reject large photo collections.

## Checks

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd run test:records
```

Backend integration test against a running PHP server and a disposable database: `API_URL=http://127.0.0.1:8080 TEST_PASSWORD=... node --test tests/backendApi.integration.mjs` (accounts and species it needs are listed at the top of the file).

Phone acceptance checklist:

1. Sign in online; create a draft with a photograph and GPS.
2. Enable airplane mode, fully close/reopen the app; verify records, images, species search and the draft remain available.
3. Add observations offline, mark ready, try Sync; verify it reports failure and retains the record.
4. Reconnect, sync and verify Synced. Sign in to the Web portal as an officer and confirm the observation is in the review queue with its photo and GPS.
5. Review it on the Web, refresh Records in the app and confirm the decision and notes appear.
6. Test denied camera/GPS permissions, poor GPS accuracy, expired session, account switching and interrupted uploads.

Automated checks cannot substitute for these physical camera, GPS and native-storage checks.
