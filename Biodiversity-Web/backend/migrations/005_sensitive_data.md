# Migration 005 Deferred: Sensitive-Field Encryption

Application-level encryption is deferred until Web and Mobile adopt a shared design. Do not apply the former encryption migration to a fresh database. The current `schema.sql` uses the original field format and requires no encryption key.

If migration 005 was already applied, retain the original key, stop all writers, back up the full database and follow [the rollback guide](../../SETUP.md#appendix-previously-encrypted-databases). The operator tool is `../bin/rollback-sensitive-data.php`.

This is a data conversion, not a request to delete/recreate users or observations. Earlier encryption tests remain historical evidence only.
