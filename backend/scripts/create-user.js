import { z } from 'zod';
import { createPool } from '../src/repository.js';
import { hashPassword } from '../src/passwords.js';
// Provision accounts from the server terminal. There is no public role-granting registration API.
const input = z.object({ name: z.string().trim().min(1).max(120), email: z.email().max(254).transform(s => s.toLowerCase()), password: z.string().min(12).max(256), role: z.enum(['botanist', 'conservation-officer']) }).parse({ name: process.env.NEW_USER_NAME, email: process.env.NEW_USER_EMAIL, password: process.env.NEW_USER_PASSWORD, role: process.env.NEW_USER_ROLE });
const pool = createPool();
try {
  await pool.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [input.name, input.email, await hashPassword(input.password), input.role]);
  console.log('User created. Password is stored as a salted scrypt hash.');
} finally { await pool.end(); }
