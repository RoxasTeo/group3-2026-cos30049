import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './passwords.js';

// Fictional development accounts only. Never load this repository in production.
export const demoAccounts = [
  { id: 1, name: 'Demo Botanist', email: 'botanist@example.com', role: 'botanist' },
  { id: 2, name: 'Demo Field Botanist', email: 'field.botanist@example.com', role: 'botanist' },
  { id: 3, name: 'Demo Conservation Officer', email: 'officer@example.com', role: 'conservation-officer' },
];
export const demoPassword = 'NiahDemo2026!';

export async function createDemoRepository(databasePath) {
  const password_hash = await hashPassword(demoPassword);
  const users = demoAccounts.map(user => ({ ...user, password_hash }));
  const records = new Map();
  const examples = [
    ['DEMO-PLANT-001', 'Canopy tree observation', 'Broad leaves; illustrative canopy-tree field notes.', 1],
    ['DEMO-PLANT-002', 'Forest fern observation', 'Fronds observed in a shaded location; identification pending.', 1],
    ['DEMO-PLANT-003', 'Understorey palm observation', 'Palm-like leaves recorded for later identification.', 1],
    ['DEMO-PLANT-004', 'Climbing plant observation', 'Climbing stem observed beside a fictional survey trail.', 1],
    ['DEMO-PLANT-005', 'Seedling observation', 'Small seedling; no species identification assigned.', 2],
    ['DEMO-PLANT-006', 'Ground herb observation', 'Low-growing plant recorded in a fictional survey plot.', 2],
  ];
  examples.forEach(([plantId, commonName, description, owner], index) => {
    const date = new Date(Date.UTC(2026, 9, 20 + index, 2)).toISOString();
    records.set(plantId, { owner, record: {
      plantId, commonName, scientificName: '', family: '', conservationStatus: 'Not assessed',
      description, habitatNotes: 'Fictional demonstration data; not a verified park observation.',
      location: { latitude: 3.81 + index * 0.001, longitude: 113.78 + index * 0.001, accuracy: 10, sample: true },
      photos: [], status: 'Synced', sample: true, createdAt: date, updatedAt: date,
    } });
  });
  const db = databasePath ? new DatabaseSync(databasePath) : null;
  if (db) {
    db.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, owner INTEGER NOT NULL, payload TEXT NOT NULL)');
    const seed = db.prepare('INSERT OR IGNORE INTO records (id, owner, payload) VALUES (?, ?, ?)');
    for (const [id, entry] of records) seed.run(id, entry.owner, JSON.stringify(entry.record));
    records.clear();
    for (const row of db.prepare('SELECT * FROM records').all()) records.set(row.id, { owner: row.owner, record: JSON.parse(row.payload) });
  }
  const accessible = (entry, user) => entry && (entry.owner === user.id || user.role === 'conservation-officer');
  return {
    storage: db ? 'sqlite (persistent demo)' : 'temporary memory',
    close() { db?.close(); },
    async ready() {},
    async userByEmail(email) { return structuredClone(users.find(user => user.email === email)); },
    async userById(id) { return structuredClone(users.find(user => String(user.id) === String(id))); },
    async list(user, search = '', limit = 25, offset = 0) {
      const term = search.toLowerCase();
      return [...records.values()].filter(entry => accessible(entry, user))
        .map(entry => entry.record)
        .filter(record => `${record.plantId} ${record.commonName} ${record.scientificName}`.toLowerCase().includes(term))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(offset, offset + limit).map(record => structuredClone(record));
    },
    async get(id, user) { const entry = records.get(id); return accessible(entry, user) ? structuredClone(entry.record) : null; },
    async create(record, user) {
      if (records.has(record.plantId)) throw Object.assign(new Error('Duplicate demo plant ID'), { code: 'ER_DUP_ENTRY' });
      const now = new Date().toISOString();
      const saved = { ...structuredClone(record), status: 'Synced', sample: true, createdAt: now, updatedAt: now };
      db?.prepare('INSERT INTO records (id, owner, payload) VALUES (?, ?, ?)').run(record.plantId, user.id, JSON.stringify(saved));
      records.set(record.plantId, { owner: user.id, record: saved });
      return structuredClone(saved);
    },
  };
}
