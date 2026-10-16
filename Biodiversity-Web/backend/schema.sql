CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'conservation_officer', 'botanist', 'admin') NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Persistent per-account throttling, including nonexistent accounts.
CREATE TABLE IF NOT EXISTS auth_login_attempts (
    account_key CHAR(64) PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    window_started BIGINT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS species (
    species_id INT AUTO_INCREMENT PRIMARY KEY,
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255) NOT NULL,
    family VARCHAR(100) NOT NULL,
    genus VARCHAR(100),
    status ENUM(
        'Not Evaluated', 
        'Data Deficient', 
        'Least Concern', 
        'Near Threatened', 
        'Vulnerable', 
        'Endangered', 
        'Critically Endangered', 
        'Extinct in the Wild', 
        'Extinct'
    ) NOT NULL DEFAULT 'Not Evaluated',
    habitat VARCHAR(200),
    description TEXT NOT NULL,
    ecological_info TEXT,
    cultural_sign TEXT,

    photo MEDIUMTEXT,
    photo_name VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB