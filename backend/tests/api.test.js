import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/passwords.js';
const secret = 'test-only-secret-012345678901234567890123456789';
const password = 'test-password-long-enough';
const users = [
  { id: 1, name: 'Botanist A', email: 'a@example.test', role: 'botanist', password_hash: await hashPassword(password) },
  { id: 2, name: 'Botanist B', email: 'b@example.test', role: 'botanist', password_hash: await hashPassword(password) },
  { id: 3, name: 'Officer', email: 'officer@example.test', role: 'conservation-officer', password_hash: await hashPassword(password) },
];
const token = id => jwt.sign({}, secret, { subject: String(id), issuer: 'niah-api', audience: 'niah-app', expiresIn: '1h' });
function fixture() {
  const records = new Map();
  const repository = {
    async ready() {},
    async userById(id) { return users.find(u => String(u.id) === id); },
    async userByEmail(email) { return users.find(u => u.email === email); },
    async list(user) { return [...records.values()].filter(r => r.owner === user.id || user.role === 'conservation-officer').map(r => r.record); },
    async get(id, user) { const r = records.get(id); return r && (r.owner === user.id || user.role === 'conservation-officer') ? r.record : null; },
    async create(record, user) { if (records.has(record.plantId)) throw Object.assign(new Error(), { code: 'ER_DUP_ENTRY' }); const result = { ...record, status: 'Synced', sample: false }; records.set(record.plantId, { owner: user.id, record: result }); return result; },
  };
  return repository;
}
const record = { plantId: 'NIAH-TEST-001', commonName: 'Fern', description: 'Field observation', location: { latitude: 3.81, longitude: 113.78, accuracy: 10 } };
test('health, readiness and CORS', async () => {
  const repository = fixture();
  const app = await createApp({ repository, secret, origins: ['http://localhost:8081'] });
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/ready').expect(200);
  repository.ready = async () => { throw new Error('DB offline'); };
  await request(app).get('/api/ready').expect(503);
  const blocked = await request(app).get('/api/health').set('Origin', 'https://untrusted.test');
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);
});
test('login validates credentials and never leaks password hashes', async () => {
  const app = await createApp({ repository: fixture(), secret });
  const result = await request(app).post('/api/auth/login').send({ email: 'a@example.test', password }).expect(200);
  assert.equal(result.body.user.role, 'botanist');
  assert.equal(result.body.user.password_hash, undefined);
  await request(app).get('/api/auth/me').auth(result.body.token, { type: 'bearer' }).expect(200);
  await request(app).post('/api/auth/login').send({ email: 'a@example.test', password: 'wrong' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'a@example.test', password, role: 'conservation-officer' }).expect(400);
});
test('authentication, roles, ownership and duplicate conflicts', async () => {
  const app = await createApp({ repository: fixture(), secret });
  await request(app).get('/api/plants').expect(401);
  await request(app).get('/api/plants').auth('forged', { type: 'bearer' }).expect(401);
  await request(app).post('/api/plants').auth(token(3), { type: 'bearer' }).send(record).expect(403);
  await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(record).expect(201);
  await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(record).expect(409);
  await request(app).get('/api/plants/NIAH-TEST-001').auth(token(2), { type: 'bearer' }).expect(404);
  await request(app).get('/api/plants/NIAH-TEST-001').auth(token(3), { type: 'bearer' }).expect(200);
  const own = await request(app).get('/api/plants').auth(token(2), { type: 'bearer' }).expect(200);
  assert.deepEqual(own.body.records, []);
});
test('invalid records, fake sync status, device photos and unsafe pagination are rejected', async () => {
  const app = await createApp({ repository: fixture(), secret });
  for (const data of [{ ...record, description: '' }, { ...record, status: 'Synced' }, { ...record, location: { latitude: 91, longitude: 0 } }, { ...record, photos: [{ uri: 'file:///phone/photo.jpg' }] }]) {
    await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(data).expect(400);
  }
  await request(app).get('/api/plants?limit=1;DROP%20TABLE%20users').auth(token(1), { type: 'bearer' }).expect(400);
  await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
});
test('expired tokens are rejected and repeated bad sign-ins are rate limited', async () => {
  const app = await createApp({ repository: fixture(), secret });
  const expired = jwt.sign({}, secret, { subject: '1', issuer: 'niah-api', audience: 'niah-app', expiresIn: -1 });
  await request(app).get('/api/auth/me').auth(expired, { type: 'bearer' }).expect(401);
  for (let n = 0; n < 10; n++) await request(app).post('/api/auth/login').send({ email: 'a@example.test', password: 'bad' }).expect(401);
  await request(app).post('/api/auth/login').send({ email: 'a@example.test', password: 'bad' }).expect(429);
});
