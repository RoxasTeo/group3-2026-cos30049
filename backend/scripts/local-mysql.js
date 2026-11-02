// Project-local Windows MySQL. No Windows service or existing database is modified.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import mysql from 'mysql2/promise';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const local = resolve(root, '.local');
const data = resolve(local, 'mysql-data-v1');
const statePath = resolve(local, 'mysql-local.json');
const binary = process.env.MYSQLD_PATH || 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqld.exe';
const action = process.argv[2] || 'start';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function save(state) { writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 }); }
async function connect(state, password = state.rootPassword) { return mysql.createConnection({ host: '127.0.0.1', port: state.port, user: 'root', password, connectTimeout: 1500 }); }
async function verify(connection) {
  const [rows] = await connection.query('SELECT @@datadir AS directory');
  if (resolve(rows[0].directory).toLowerCase() !== data.toLowerCase()) throw new Error('Port belongs to a different MySQL instance. Nothing changed.');
}
async function portFree(port) {
  await new Promise((resolve, reject) => { const server = createServer(); server.once('error', error => reject(new Error(`Cannot bind port ${port} (${error.code}). Nothing changed.`))); server.listen(port, '127.0.0.1', () => server.close(resolve)); });
}
function configureApp(state) {
  const file = resolve(root, '.env');
  let content = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const backup = resolve(local, 'env-before-local-mysql');
  if (content && !existsSync(backup)) writeFileSync(backup, content, { mode: 0o600 });
  const values = { DB_HOST: '127.0.0.1', DB_PORT: state.port, DB_NAME: 'niah_biodiversity', DB_USER: 'niah_app', DB_PASSWORD: state.appPassword };
  if (!/^JWT_SECRET=.+$/m.test(content)) values.JWT_SECRET = randomBytes(48).toString('hex');
  if (!/^HOST=/m.test(content)) values.HOST = '127.0.0.1';
  if (!/^PORT=/m.test(content)) values.PORT = 3000;
  const cors = /^CORS_ORIGINS=(.*)$/m.exec(content)?.[1].trim() || '';
  values.CORS_ORIGINS = [...new Set([...cors.split(',').filter(Boolean), 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:5173', 'http://127.0.0.1:5173'])].join(',');
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`;
  }
  writeFileSync(file, content, { mode: 0o600 });
}
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Local setup is for development only.');
  if (!['start', 'stop', 'status'].includes(action)) throw new Error('Use start, stop or status.');
  if (!existsSync(binary)) throw new Error('MySQL Server was not found. Set MYSQLD_PATH to mysqld.exe.');
  mkdirSync(local, { recursive: true });
  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
  if (!state && action !== 'start') { console.log('Project MySQL is not set up.'); return; }
  if (!state) {
    if (existsSync(data)) throw new Error('Data exists without its local configuration. Refusing to overwrite it.');
    await portFree(13306);
    state = { port: 13306, rootPassword: randomBytes(32).toString('hex'), appPassword: randomBytes(32).toString('hex'), initialized: false, secured: false };
    save(state);
  }
  let connection;
  try { connection = await connect(state, state.secured ? state.rootPassword : ''); await verify(connection); }
  catch (error) { if (connection) { await connection.end(); throw error; } }
  if (action === 'stop') {
    if (!connection) { console.log('Project MySQL is not running.'); return; }
    await connection.query('SHUTDOWN'); await connection.end(); console.log('Project MySQL stopped safely.'); return;
  }
  if (action === 'status') { console.log(connection ? 'Project MySQL is running on 127.0.0.1:13306.' : 'Project MySQL is stopped.'); await connection?.end(); return; }
  if (!connection) {
    await portFree(state.port);
    if (!state.initialized) {
      if (existsSync(data)) throw new Error('An incomplete initialization exists. Inspect .local/mysql-init.log; no data was removed.');
      console.log('Initializing a new project MySQL data directory…');
      const log = openSync(resolve(local, 'mysql-init.log'), 'a');
      const status = await new Promise((resolve, reject) => {
        const child = spawn(binary, ['--no-defaults', '--initialize-insecure', `--datadir=${data}`, '--console'], { cwd: root, windowsHide: true, stdio: ['ignore', log, log] });
        child.on('error', reject); child.on('exit', resolve);
      });
      closeSync(log);
      if (status !== 0) throw new Error('MySQL initialization failed. Inspect .local/mysql-init.log.');
      state.initialized = true; save(state);
    }
    const log = openSync(resolve(local, 'mysql-server.log'), 'a');
    const child = spawn(binary, ['--no-defaults', `--datadir=${data}`, `--port=${state.port}`, '--bind-address=127.0.0.1', '--mysqlx=OFF', '--console'], { cwd: root, windowsHide: true, stdio: ['ignore', log, log] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    closeSync(log);
    child.on('exit', code => { if (code) console.error('MySQL stopped; see .local/mysql-server.log.'); });
    for (let i = 0; i < 40; i++) {
      try { connection = await connect(state, state.secured ? state.rootPassword : ''); break; } catch { await delay(500); }
    }
    if (!connection) throw new Error('MySQL did not start. Inspect .local/mysql-server.log.');
    await verify(connection);
  }
  try {
    if (!state.secured) {
      await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [state.rootPassword]);
      state.secured = true; save(state);
    }
    await connection.query('CREATE DATABASE IF NOT EXISTS niah_biodiversity CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
    await connection.query("CREATE USER IF NOT EXISTS 'niah_app'@'127.0.0.1' IDENTIFIED BY ?", [state.appPassword]);
    await connection.query("GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES ON niah_biodiversity.* TO 'niah_app'@'127.0.0.1'");
    configureApp(state);
    console.log('MySQL ready on 127.0.0.1:13306. Backend .env configured; credentials remain private.');
    console.log('Keep this terminal open while developing. Stop safely from another terminal with npm run db:stop.');
  } finally { await connection.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
