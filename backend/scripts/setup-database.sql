-- Run in MySQL Workbench or phpMyAdmin as a database administrator.
-- Replace the placeholder password before running this script.
CREATE DATABASE IF NOT EXISTS niah_biodiversity CHARACTER SET utf8mb4;
CREATE USER 'niah_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_YOUR_OWN_STRONG_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES
  ON niah_biodiversity.* TO 'niah_app'@'localhost';
-- Table creation is managed by: npm run db:init
