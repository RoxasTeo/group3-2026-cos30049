# Mobile Records workflow

See README.md for startup, scope and phone acceptance checks.

Routes: `/navigation/botanist/records`, `/plant/new`, `/plant/:plantId`, `/plant/reference`. Login and Botanist role are required.

The shared store writes each change to account-scoped SQLite (localStorage on web) before notifying screens. Logout clears memory only; the next sign-in to the same API/account reloads saved data. Native session restoration uses SecureStore. Local photos are preserved in the document directory; downloaded server photos are embedded in the cached record.

Drafts can be incomplete and can be edited/deleted. Mark ready requires observations and valid GPS; known accuracy above 30 m blocks readiness. Scientific identification and photos remain optional. Height is optional and limited to 0–150 metres. Up to four validated images are supported.

State transitions: Draft → Pending sync → Synced or Failed. Only a confirmed API response sets Synced. Failed/Pending records can return to Draft for corrections, except during an active upload. Synced records are read-only. Same-ID conflicts preserve local data and never overwrite server data.

Refresh downloads every page before replacing the remote cache. Local unsent records are preserved. If fieldwork changes during refresh, retry instead of applying a stale response. Sync cancels local updates if the active account changes. A lost upload response can be retried without creating duplicates.

Details display a QR tag encoded as `plant:ID`. Scan can resolve downloaded records offline. Unknown IDs open a new draft; a server ID not yet downloaded may later conflict and is never overwritten.

Tests cover store validation, persistence, account separation, disk-write failure, upload confirmation, capture policy, API pagination/authentication and QR payload parsing. Native hardware/offline acceptance is documented in README.md.
