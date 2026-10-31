import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createPool } from '../src/repository.js';
import { createDemoRepository, demoAccounts, demoPassword } from '../src/demo-repository.js';
import { hashPassword } from '../src/passwords.js';
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(process.env.DB_HOST || '127.0.0.1')) throw new Error('Development fixtures may only be loaded into a local development database.');
const pool = createPool();
const connection = await pool.getConnection();
try {
  await connection.beginTransaction();
  const passwordHash = await hashPassword(demoPassword);
  for (const user of demoAccounts) {
    const [existing] = await connection.execute('SELECT id, email FROM users WHERE id = ? OR email = ?', [user.id, user.email]);
    if (existing.length) {
      if (existing.length !== 1 || existing[0].id !== user.id || existing[0].email !== user.email) throw new Error('Development account IDs conflict with existing accounts. No data was changed.');
    } else await connection.execute('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [user.id, user.name, user.email, passwordHash, user.role]);
  }
  let entries = [];
  if (existsSync('.local/demo.sqlite')) {
    const source = new DatabaseSync('.local/demo.sqlite', { readOnly: true });
    try { entries = source.prepare('SELECT id, owner, payload FROM records').all().map(row => ({ owner: row.owner, record: JSON.parse(row.payload) })); } finally { source.close(); }
  } else {
    const demo = await createDemoRepository();
    for (const user of demoAccounts.filter(u => u.role === 'botanist')) for (const record of await demo.list(user, '', 100, 0)) entries.push({ owner: user.id, record });
  }
  let added = 0, kept = 0;
  for (const { owner, record } of entries) {
    const [existing] = await connection.execute('SELECT plant_id FROM plant_records WHERE plant_id = ?', [record.plantId]);
    if (existing.length) { kept++; continue; }
    await connection.execute('INSERT INTO plant_records (plant_id, owner_id, common_name, scientific_name, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [record.plantId, owner, record.commonName, record.scientificName, JSON.stringify({ ...record, sample: true }), new Date(record.createdAt), new Date(record.updatedAt)]);
    added++;
  }
  await connection.commit();
  console.log(`Development accounts available. Imported ${added} fictional records; kept ${kept} existing records. Original SQLite data is unchanged.`);
} catch (error) { await connection.rollback(); console.error(error.code || error.message); process.exitCode = 1; }
finally { connection.release(); await pool.end(); }
