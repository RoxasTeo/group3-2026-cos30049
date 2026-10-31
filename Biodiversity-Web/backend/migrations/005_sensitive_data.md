# 005 — Sensitive data encryption

This is an operator data migration, not a SQL-only migration. Never replace email values or drop their old index without configuring the key, creating the verified encrypted backup and completing the data conversion.

Follow `../../security/DATA_PROTECTION.md`. The implementation is `../bin/encrypt-sensitive-data.php`; it checks existing structure, preserves IDs and password hashes, and supports verification/retry. Fresh installations use the updated `schema.sql` instead.

Application code and this migration must be released together, with all writers stopped. Back up the full database separately. The tool's encrypted snapshot contains only the protected records/fields needed by its limited recovery command.
