# React Native App

An Expo React Native starter using TypeScript.

## Edit in Visual Studio Code

Open this folder in VS Code. Edit `App.tsx` to change the main screen.

## Run

In the VS Code terminal:

```powershell
npm.cmd start
```

Scan the QR code with a compatible Expo Go app on your phone. Keep the phone and computer on the same Wi-Fi network. You can also press `a` to open an Android emulator if Android Studio and an emulator are installed.

If PowerShell blocks npm scripts, use `npm.cmd` as shown above.

## Check TypeScript

```powershell
npx.cmd tsc --noEmit
```

## Main files

- `App.tsx`: Main screen and styles.
- `assets/`: App images and icons.
- `app.json`: App name, icons, and Expo settings.
- `package.json`: Dependencies and run commands.

Native iOS simulator builds require macOS and Xcode.

## Login screen design

The app now opens `src/screens/LoginScreen.tsx`. `App.tsx` provides safe-area and status-bar setup.

- Proposed display name: Niah Biodiversity (not official branding).
- Botanist-focused mobile login, based on the project proposal.
- Email/password input, show/hide password, basic input errors and administrator-help messages.
- This is a UI prototype: it does not authenticate users, store credentials, send reset emails, or provide role-based navigation yet.
- Future integration: authenticate through the backend and use its verified account role for navigation and authorization. A client-side role selection must not grant permissions.

For a browser preview, run `npm.cmd run web`. For lint, run `npm.cmd run lint`.

Checked with TypeScript, Expo lint, and the browser preview at 320px and 390px widths. Native device and keyboard testing is still needed.

## Role-based navigation preview

Navigation now uses Expo Router. `index.ts` loads `src/app/_layout.tsx`; the root route still shows the original login screen. `App.tsx` is the earlier standalone login wrapper and is no longer the entry point.

Run `npm.cmd run web`, then add `/navigation` to the browser address to open the Botanist shell.

- `/navigation/botanist/home`: Home, Scan, Records, Sync, Profile.
- `/navigation/conservation-officer/home`: Home, Species, Review, Reports, Profile.

Records and the manual QR workflow now have interactive screens. Other feature tabs remain placeholders. Tabs update the route and selected highlight. Unknown roles return to login; unavailable tabs return to that role's Home page.

Edit `src/navigation/roles.ts` to change menu items, `src/components/RoleNavigationBar.tsx` for the bar design, and `src/screens/NavigationShell.tsx` for the blank page layout. Routes are in `src/app/`.

These role URLs are UI previews, not authenticated access. The proposal's primary mobile user is the Botanist; the Conservation Officer configuration demonstrates the alternative menu only. Before adding protected content, connect the authenticated role and enforce permissions on the backend.

## Sprint 1 QR workflow

Open `/navigation/botanist/scan`. Manual entry `NIAH-PLANT-001` opens the seeded local
record; a new valid ID opens a prefilled entry form. The in-memory repository is intentionally
replaceable by offline storage or a backend adapter. Camera access is isolated in
`src/services/qrScannerAdapter.ts`; this build has no scanner package, so manual entry is the
development fallback.

Run `npx.cmd tsc --noEmit` and `npx.cmd expo lint` from `mobile`.

## Botanist Records page

Run `npm.cmd run web`, then visit `/navigation/botanist/records`. See [Records handoff](RECORDS.md) for behavior, data contracts and remaining storage/sync integration.

- Search sample records by name, scientific name or plant/temporary ID; combine with All, Drafts, Pending sync, Synced or Failed filters.
- View details, illustrative photographs/GPS, collection dates and status explanations.
- Create an incomplete draft using an automatically assigned temporary ID. Names and scientific identification may be unknown.
- Continue a draft, save changes, or mark it Pending sync after validation. Read-only records cannot be edited, overwritten or deleted.
- Delete drafts with confirmation, and confirm leaving a form with unsaved changes.
- Uses the existing QR routes and a reactive session-only repository. This is not SQLite persistence or a real server sync. Changes are lost on full reload/app restart. Synced/Failed seed records and location/photo attachments are explicitly labelled samples.

Checks: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run test:records`. Browser checks cover list/search/filter/detail, draft validation and transitions, unsaved changes, deletion, QR lookup and widths 320/390/480px. Physical-device camera, GPS and native keyboard/hardware-back testing are not yet verified.
