import { mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createApp } from './app.js';
import { createPool, createRepository } from './repository.js';
const demoLan = process.argv.includes('--demo-lan');
const demo = process.argv.includes('--demo') || demoLan;
if (demo && process.env.NODE_ENV === 'production') throw new Error('Demo mode is not allowed in production.');
if (demo) mkdirSync('.local', { recursive: true });
const pool = demo ? null : createPool();
const repository = demo ? await (await import('./demo-repository.js')).createDemoRepository('.local/demo.sqlite') : createRepository(pool);
if (!demo) { try { await repository.ready(); } catch { await pool.end(); throw new Error('MySQL is not ready. Run npm run db:start and npm run db:init first.'); } }
const app = await createApp({ repository, mode: demo ? 'demo' : 'mysql', secret: process.env.JWT_SECRET || (demo ? randomBytes(48).toString('hex') : undefined), origins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean) });
// Known demo credentials must not inherit a public bind address from the normal server.
const host = demo ? (demoLan ? '0.0.0.0' : '127.0.0.1') : process.argv.includes('--lan') ? '0.0.0.0' : process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, host, () => {
  console.log(`Niah API listening on http://${host}:${port}/api/health`);
  if (demoLan) console.log('LAN demo enabled for local phone testing. Use only fictional demo credentials on a trusted Wi-Fi network.');
  if (demo) console.log('DEMO MODE: fictional development database in .local/demo.sqlite; records persist across restarts. This is a local server, not a hosted cloud service. See README for demo logins.');
});
server.on('error', async err => { console.error(err.message); await pool?.end(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(async () => { await pool?.end(); process.exit(0); }); });
