import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { createRepository } from '../src/repository.js';
import { initializeSchema } from '../src/schema.js';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/passwords.js';
import { createNiahApi } from '../../shared/niah-api.mjs';

test('real MySQL: mobile upload is visible to authorized web client and survives reconnect', { skip: process.env.MYSQL_INTEGRATION !== '1' }, async () => {
 const state = JSON.parse(readFileSync('.local/mysql-local.json', 'utf8'));
 const config = { host: '127.0.0.1', port: state.port, user: 'root', password: state.rootPassword, timezone: 'Z', charset: 'utf8mb4' };
 const admin = await mysql.createConnection(config);
 const database = `niah_test_${randomBytes(8).toString('hex')}`;
 let pool, server;
 try {
  await admin.query('CREATE DATABASE ' + mysql.escapeId(database) + ' CHARACTER SET utf8mb4');
  pool = mysql.createPool({ ...config, database });
  await initializeSchema(pool); await initializeSchema(pool);
  const password = 'IntegrationPassword2026!';
  const hash = await hashPassword(password);
  for (const [id, role] of [[1, 'botanist'], [2, 'botanist'], [3, 'conservation-officer']]) await pool.execute('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)', [id, `User ${id}`, `user${id}@example.test`, hash, role]);
  const repository = createRepository(pool);
  const app = await createApp({ repository, secret: 'integration-only-secret-01234567890123456789', origins: ['http://localhost:5173'] });
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let mobileToken, webToken, otherToken;
  const mobile = createNiahApi({ baseUrl, getToken: () => mobileToken });
  const web = createNiahApi({ baseUrl, getToken: () => webToken });
  const other = createNiahApi({ baseUrl, getToken: () => otherToken });
  mobileToken = (await mobile.login('user1@example.test', password)).token;
  webToken = (await web.login('user3@example.test', password)).token;
  otherToken = (await other.login('user2@example.test', password)).token;
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#234532' } }).png().toBuffer();
  const input = { plantId: 'MYSQL-TEST-001', commonName: 'Forest fern 🌿', description: 'Observed in shade', morphology: 'Pinnate fronds', heightMetres: '0.8', location: { latitude: 3.81, longitude: 113.78, accuracy: 6 }, photos: [{ id: 'one', caption: 'Frond', data: `data:image/png;base64,${png.toString('base64')}` }] };
  const { record } = await mobile.createPlant(input);
  assert.equal(record.status, 'Synced'); assert.equal(record.ownerId, 1); assert.equal(record.sample, false);
  assert.equal(record.commonName, input.commonName);
  const replay = await mobile.createPlant(input); assert.equal(replay.record.createdAt, record.createdAt);
  await assert.rejects(mobile.createPlant({ ...input, description: 'Different' }), e => e.status === 409);
  const list = await web.listPlants({ search: 'fern' }); assert.equal(list.records.length, 1); assert.equal(list.records[0].plantId, input.plantId);
  const detailed = await web.getPlant(input.plantId); assert.equal(detailed.record.heightMetres, '0.8'); assert.match(detailed.record.photos[0].uri, /^data:image\/jpeg;base64,/);
  await assert.rejects(other.getPlant(input.plantId), e => e.status === 404);
  await assert.rejects(web.createPlant({ ...input, plantId: 'OFFICER-DENIED' }), e => e.status === 403);
  const preflight = await fetch(`${baseUrl}/plants`, { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  await pool.end(); pool = mysql.createPool({ ...config, database });
  const persisted = await createRepository(pool).get(input.plantId, { id: 3, role: 'conservation-officer' });
  assert.equal(persisted.description, input.description); assert.equal(persisted.photos.length, 1);
 } finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await pool?.end();
  // Only remove the uniquely named database created by this test, never application data.
  if (!/^niah_test_[a-f0-9]{16}$/.test(database)) throw new Error('Unexpected test database name');
  await admin.query('DROP DATABASE IF EXISTS ' + mysql.escapeId(database)); await admin.end();
 }
});
