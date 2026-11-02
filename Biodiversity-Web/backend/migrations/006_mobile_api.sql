-- Mobile app integration: bearer-token sign-in and the extra field-record columns the app collects.
-- Run once on databases created before this change. Fresh installs get these from schema.sql.
CREATE TABLE IF NOT EXISTS mobile_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY mobile_token_user (user_id, expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE observations
    ADD COLUMN morphology TEXT NULL AFTER habitat,
    ADD COLUMN conservation_status VARCHAR(40) NOT NULL DEFAULT '' AFTER morphology;
