import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
export function createPool() {
  return mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'niah_app', password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'niah_biodiversity', ssl: process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA, 'utf8'), rejectUnauthorized: true } : undefined, charset: 'utf8mb4', connectionLimit: 5, timezone: 'Z', connectTimeout: 5000 });
}
export function createRepository(pool) {
  const publicRecord = row => ({ ...(typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload), status: 'Synced', sample: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload).sample === true, ownerId: row.owner_id, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() });
  return {
    storage: 'mysql',
    async ready() { await pool.query('SELECT id FROM users LIMIT 1'); await pool.query('SELECT plant_id FROM plant_records LIMIT 1'); },
    async userByEmail(email) { const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]); return rows[0]; },
    async userById(id) { const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]); return rows[0]; },
    async list(user, search, limit, offset) {
      const scope = user.role === 'conservation-officer' ? '1=1' : 'owner_id = ?';
      const args = user.role === 'conservation-officer' ? [] : [user.id];
      const [rows] = await pool.execute(`SELECT * FROM plant_records WHERE ${scope} AND (plant_id LIKE ? OR common_name LIKE ? OR scientific_name LIKE ?) ORDER BY updated_at DESC, plant_id DESC LIMIT ${limit} OFFSET ${offset}`, [...args, `%${search}%`, `%${search}%`, `%${search}%`]);
      return rows.map(publicRecord);
    },
    async get(id, user) {
      const [rows] = await pool.execute('SELECT * FROM plant_records WHERE plant_id = ? AND (owner_id = ? OR ? = ?)', [id, user.id, user.role, 'conservation-officer']);
      return rows[0] ? publicRecord(rows[0]) : null;
    },
    async create(record, user) {
      await pool.execute('INSERT INTO plant_records (plant_id, owner_id, common_name, scientific_name, payload) VALUES (?, ?, ?, ?, ?)', [record.plantId, user.id, record.commonName, record.scientificName, JSON.stringify(record)]);
      return this.get(record.plantId, user);
    },
  };
}

