import { createPool } from '../src/repository.js';
import { initializeSchema } from '../src/schema.js';
const pool = createPool();
try { await initializeSchema(pool); console.log('Database tables are ready. Existing records preserved.'); } finally { await pool.end(); }
