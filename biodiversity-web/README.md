# Niah Conservation Officer Web UI

Sprint 1 frontend for the group's Smart Ground-Truthing and Digital Biodiversity System. Built with Vue 3, Vue Router and Vite. Uses the Vue single-file component approach described in https://vuejs.org/guide/quick-start.html.

## Run on Windows

Open this folder in VS Code. In its terminal:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed in the terminal (usually http://127.0.0.1:5173). Keep the terminal running. Use Ctrl+C to stop. Node.js 22.12+ or 24 LTS is suitable for this Vite 7 project.

```powershell
npm.cmd run build
npm.cmd run preview
```

## Included

- Dashboard totals calculated from the current collection, status distribution and recent updates.
- Species list with scientific/common-name search and family/status filters.
- Species profile and shared add/edit form, required fields and duplicate scientific-name validation.
- JPG/PNG/WebP photo preview, maximum 1 MB per record.
- Delete confirmation and unsaved-change prompt when navigating between app routes.
- Responsive navigation, labelled forms, keyboard focus and empty/error states.
- Local browser persistence with storage-error feedback.

All seed species names and assessments are deliberately fictional. Do not present them as verified Niah records. Browser storage is specific to the browser and URL/port; clearing it removes demo changes. Photos are stored as data URLs and count towards browser storage limits. There is no backend upload or cloud sync. The Google Fonts stylesheet is optional; system sans-serif fonts work offline.

## Project structure

- `src/App.vue`: workspace shell and navigation.
- `src/views/`: dashboard, list, details and add/edit pages.
- `src/components/StatusBadge.vue`: reusable status presentation.
- `src/services/speciesService.js`: collection state and persistence boundary.
- `src/data/mockSpecies.js`: demo records and status options.
- `src/style.css`: responsive styling.
- `src/main.js`: Vue app and hash routes.

## Team integration

Replace browser persistence in `speciesService.js` with the team's API. Agree on endpoint names before implementation. Suggested contract: GET/POST `/api/species`, GET/PATCH/DELETE `/api/species/:id`, plus a separate authenticated multipart photo upload. These endpoints are proposals and are not implemented.

Species fields: `id`, `scientificName`, `commonName`, `family`, `genus`, `status`, `habitat`, `description`, `ecologicalNotes`, `culturalNotes`, `photo`, `photoName`, `updatedAt`.

Keep species separate from individual plants/observations: GPS coordinates, QR tags and field observations should reference a species through `speciesId`. Do not attach one specimen's GPS coordinate to an entire species.

The backend must enforce authentication, officer permissions, validation, uniqueness, photo validation and authorization. This prototype has a role label only; it is not a secure login system. Authentication/backend CRUD are separate Sprint 1 team tasks. Observation approval, report export and IoT monitoring are Sprint 2 and are not implemented here.

## Demo checklist

1. Open Overview; check the three totals and recent records.
2. Open Species management; search `Demo` and combine family/status filters.
3. Clear filters, add a species, fill required fields and optionally select a photo.
4. Save and verify the profile. Reload to verify browser persistence.
5. Edit the record; verify dashboard counts update if the status changes.
6. Try a duplicate scientific name; confirm the form explains the error.
7. Cancel deletion once, then confirm deletion and verify the record disappears.
8. Use a narrow/mobile window and navigate with the keyboard.

Source requirements: Project Scope-2.pdf, Digital Plant Knowledge System / Conservation Officer role; COS30049 Project_Proposal_Group_3.docx, Initial Release Schedule item 4. Dashboard metric choices are implementation suggestions, not prescribed requirements.

## Verification performed

Production build passed with `npm.cmd run build -- --configLoader native`. Automated Microsoft Edge checks passed for search, clearing filters, creation, refresh persistence, editing, canceling/confirming deletion, duplicate-name rejection, mobile dashboard overflow, and absence of JavaScript runtime errors. Desktop and mobile dashboard screenshots were visually inspected.

The Codex restricted filesystem prevented esbuild from scanning an ancestor directory during development-server startup. The compiled app was tested with `npm.cmd run preview -- --configLoader native --port 5173` instead. Ordinary local development outside the Codex sandbox uses the normal commands above. Photo selection, browser quota failures and full keyboard/screen-reader accessibility have not been comprehensively tested.
