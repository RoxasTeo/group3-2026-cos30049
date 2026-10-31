# Data Protection Status and Encryption Rollback

## Current Status (2026-11-01)

Application-level sensitive-field encryption is deferred until Web and Mobile can use one agreed data contract. Fresh local installations require **no encryption key**, HMAC email index or encryption migration. Use the current `backend/schema.sql` and [Web Setup Guide](../SETUP.md).

User names, email addresses, observation `field_notes`/`habitat` and review `notes` now use the original unencrypted database format. Passwords remain bcrypt hashes. Session authentication, live account/role checks, CSRF controls, input validation and the restricted runtime database account remain in place. Device upload keys remain hashed.

This does not claim encryption at rest for personal information, photos, GPS or database files. Keep the local database and backups private. Full-disk/database encryption, production HTTPS and the shared Web/Mobile encryption design remain separate work.

## Existing Databases Previously Encrypted by Migration 005

Do not simply switch code or generate a replacement key: this version expects the original field format. Convert the existing database using its matching original key first. Preserve IDs, password hashes, roles, decisions and relationships; do not recreate accounts or delete observations to bypass migration.

1. Stop **all** backend instances and other writers. The current runtime no longer has the old encryption maintenance gate; setting a variable alone does not stop services.
2. Back up the complete database to a restricted directory outside Git. Keep the original key and old encrypted snapshots. The rollback tool also creates and verifies a private encrypted sensitive-field snapshot, but this is not a full backup.
3. Retain these settings in the local, ignored backend `.env` for the operator tool only:

   ```dotenv
   DATA_ENCRYPTION_KEY_FILE=C:/private/path/to/original/data.key
   DATA_ENCRYPTION_BACKUP_DIR=C:/private/path/to/backups
   DATA_ENCRYPTION_MAINTENANCE=true
   ```

   Paths must be absolute and outside every Git working tree. Do not overwrite an existing key or expose credentials. The normal Web runtime ignores these settings and does not load the legacy cipher helper.
4. In a private PowerShell terminal at the repository root, temporarily use a database operator account with schema privileges. Keep the ordinary `.env` runtime account restricted:

   ```powershell
   $env:DB_USER = 'YOUR_DATABASE_OPERATOR'
   $operatorSecret = Read-Host 'Database operator password' -AsSecureString
   $env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $operatorSecret).Password
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --check
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --apply
   php Biodiversity-Web/backend/bin/rollback-sensitive-data.php --check
   Remove-Item Env:DB_USER
   Remove-Item Env:DB_PASSWORD
   Remove-Variable operatorSecret
   ```

   Run one command at a time and inspect its result. The initial check returns 2 when a verified conversion is pending; the final check must return 0. If any command fails, stop, clear temporary credentials, investigate and keep all writers offline. Do not start the unencrypted application against remaining ciphertext.
5. The tool authenticates encrypted fields using the original key, verifies the private encrypted snapshot before writes, converts protected fields, restores VARCHAR user fields and the unique plaintext email index, and removes `email_lookup`/`data_protection_state`. Old keyed login-attempt counters are cleared once. IDs, password hashes and business relationships are preserved.
6. MySQL schema changes are not fully transactional with field updates. If the schema stage fails, keep writers stopped and rerun with the original key after investigating. The tool accepts already-converted fields for retry, but never treats invalid ciphertext as plaintext. Restore the full pre-conversion backup with its matching code/key if recovery is needed.
7. After the final check passes, set `DATA_ENCRYPTION_MAINTENANCE=false`, clear operator overrides and start the normal services. Verify existing login, registration, review, reports and maps. Keep the old private key and backups until recovery requirements have been resolved; do not commit or automatically delete them.

`backend/bin/legacy-field-encryption.php` is CLI-only compatibility code for this rollback. It is not required by Web requests and does not enable field encryption. Encryption-generation, apply and encrypted restore commands have been removed from the active setup.
