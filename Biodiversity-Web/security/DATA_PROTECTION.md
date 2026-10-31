# Local Sensitive Data Protection and Operations Guide

This implementation provides application-level field encryption. It does not mean that the entire MySQL database or disk is encrypted, and it does not replace HTTPS. The current environment uses a local database and has not been deployed.

## Protection Scope

| Data | Storage |
| --- | --- |
| User names and email addresses | AES-256-GCM ciphertext |
| Observation `field_notes` and `habitat` | AES-256-GCM ciphertext |
| Review `notes` | AES-256-GCM ciphertext |
| Login email lookup | HMAC-SHA-256 index using a separately derived key; searches do not use plaintext or encrypted email values directly |
| Passwords | Existing bcrypt hashes; passwords cannot be decrypted |
| Device upload keys | Hashes of random keys; the original key is shown only when created or replaced |

Public species knowledge, taxonomy, statuses, review decisions/checklists, plant photographs, GPS coordinates, sensor values, IDs and timestamps are not all encrypted in this implementation. Photographs may contain metadata; upload only plant photographs permitted by the project. The system has no separate module for the generic scope term "performance records", so protection of such a module is not claimed. Additional protection requirements for location or photograph data should be agreed separately.

Each encryption operation uses a fresh 12-byte random IV and a 16-byte authentication tag. The field and its owning user, observation or review identity are included as authenticated data to prevent moving ciphertext between rows or fields. The format is `enc:v1:<base64>`; Base64 is only a container, while AES-GCM provides confidentiality. HKDF derives separate keys for encryption and email lookup. The database also stores an authenticated encrypted key-check marker. Login and sensitive writes verify the key before proceeding, so even a correctly formatted but mismatched key cannot silently create mixed-key records. The email index reveals equality between matching values, a trade-off required for unique email addresses and login lookup.

Implementation references: [PHP OpenSSL authenticated encryption](https://www.php.net/openssl-encrypt) and [PHP AEAD specification](https://wiki.php.net/rfc/openssl_aead). No custom block cipher is used.

## Keys and Local Configuration

1. Create a private directory **outside all Git working trees**. On Windows, restrict the ACL to the runtime account and SYSTEM. On POSIX, recommended permissions are 0700 for directories and 0600 for files. The generator neither overwrites existing files nor displays key contents.
2. Run `php Biodiversity-Web/backend/bin/generate-data-key.php <private-key-file>`.
3. In the Git-ignored `Biodiversity-Web/backend/.env`, set `DATA_ENCRYPTION_KEY_FILE` to the absolute key-file path and `DATA_ENCRYPTION_BACKUP_DIR` to a private backup directory outside the repository. Never commit keys, real credentials or encrypted backups to Git.
4. Keep a separate secure backup of the key. **Losing the key makes existing ciphertext and encrypted backups unrecoverable.** Do not replace an active key file directly. This version has no online key-rotation service; rotation requires a controlled process using the old key to decrypt, re-encrypt and rebuild lookup indexes.

The local preview uses a dedicated database runtime account with only SELECT/INSERT/UPDATE/DELETE on the local database. Schema creation, migrations and trigger-based fault injection use separate operator privileges. The runtime account cannot create tables, drop databases or change grants. Real database passwords remain in private configuration and are excluded from documentation and test output.

## Migrating an Existing Database

Application code and field formats must be upgraded together. Changing only the schema or only the code is insufficient; older services that query plaintext email addresses will no longer work. API response formats for names, emails, observations and review text remain unchanged; the backend decrypts them after authentication and authorization.

1. Back up the complete database and stop all writers. Set `DATA_ENCRYPTION_MAINTENANCE=true` in the actual runtime configuration; Web APIs will return a maintenance response. Setting an environment variable in one terminal does not stop other services from writing.
2. Check key and backup directory permissions, then run:

   ```sh
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --apply
   php Biodiversity-Web/backend/bin/encrypt-sensitive-data.php --check
   ```

   `--check` returns 0 when encryption and index structure are correct, or 2 when migration is pending. The tool does not display data contents.
3. `--apply` first creates and verifies an **encrypted snapshot of sensitive fields** in memory. It then expands user fields to TEXT, creates the unique email lookup index and updates sensitive fields within a transaction. User IDs, password hashes, roles, review decisions and foreign-key relationships are preserved. This snapshot is not a complete database backup.
4. MySQL DDL and all field updates cannot form one fully rollback-capable transaction. If the schema stage fails, remain in maintenance mode, investigate and retry. Existing ciphertext is authenticated and decrypted before processing to avoid double encryption. Incorrect keys or damaged ciphertext are never treated as plaintext.
5. Migration clears legacy login-attempt counters once; subsequent attempts use the keyed email index. Run it during maintenance, and never repeatedly migrate to bypass login throttling.
6. Verify login, permissions and business operations, then set `DATA_ENCRYPTION_MAINTENANCE=false` and start services.

For a new database, use the updated `schema.sql`. After configuring the key, create the first account through the CLI. The CLI initializes the key-check marker only when the users table is empty; public registration cannot initialize it. Test fixture tools use the same encrypted write path rather than inserting plaintext users.

## Restoring Sensitive Fields

Keep the key that matches the backup. With all writers stopped and maintenance mode enabled, run:

```sh
php Biodiversity-Web/backend/bin/restore-sensitive-data.php <private-encrypted-backup> --apply
```

The tool verifies that the backup belongs to the current database, original rows still exist, and observation/review identities have not changed. It then saves the sensitive fields **as ciphertext again**. It does not restore the entire database, overwrite password hashes or decisions, or delete rows created after the backup. Keep a current full database backup before restoring to avoid unintentionally replacing correct data with older values.

## Protection Boundaries

- Keys are stored in a persistent private directory outside the repository and temporary preview directory. The local `.env` references the actual path; keys are not distributed with the repository.
- Encryption does not provide tamper protection for every database column. Roles, statuses and other unencrypted fields still depend on database integrity and business authorization.
- Missing or incorrect keys and modified ciphertext cause reads to fail, without plaintext fallback. Web responses contain generic errors. Exception argument output is disabled to avoid including names, emails or passwords in stack traces.
- The backend must still decrypt data for authorized users. Attackers with host access and the ability to read the key are outside this field-encryption protection boundary.
- Historical database files, undo/redo logs, old backups and system snapshots may retain earlier plaintext. Secure erasure of these physical copies is not claimed. Full disk/database/backup protection and production HTTPS require separate acceptance checks.
- The scope's trainers/guides terminology differs from the current Admin/Conservation Officer/Botanist/General User roles. Permissions follow the botanical project roles; the team should confirm the correspondence. This alone does not establish regulatory compliance.
