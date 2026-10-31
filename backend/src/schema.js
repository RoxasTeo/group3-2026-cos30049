export async function initializeSchema(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role ENUM('botanist','conservation-officer') NOT NULL, created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS plant_records (plant_id VARCHAR(64) PRIMARY KEY, owner_id INT UNSIGNED NOT NULL, common_name VARCHAR(200) NOT NULL, scientific_name VARCHAR(200) NOT NULL, payload JSON NOT NULL, created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3), updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), FOREIGN KEY(owner_id) REFERENCES users(id), INDEX(owner_id, updated_at))`);
}
