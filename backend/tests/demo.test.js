import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDemoRepository, demoPassword } from '../src/demo-repository.js';
import { createApp } from '../src/app.js';

test('demo accounts log in and respect ownership, search and pagination', async () => {
  const repository = await createDemoRepository();
  const app = await createApp({ repository, secret: 'test-demo-secret-that-is-at-least-32-characters', mode: 'demo' });
  const ready = await request(app).get('/api/ready').expect(200);
  assert.equal(ready.body.database, 'not used');
  for (const [email, count] of [['botanist@example.com', 4], ['field.botanist@example.com', 2], ['officer@example.com', 6]]) {
    const login = await request(app).post('/api/auth/login').send({ email, password: demoPassword }).expect(200);
    const response = await request(app).get('/api/plants').auth(login.body.token, { type: 'bearer' }).expect(200);
    assert.equal(response.body.records.length, count);
    assert.ok(response.body.records.every(record => record.sample));
    assert.equal(login.body.user.password_hash, undefined);
  }
  const user = await repository.userById(1);
  assert.equal((await repository.list(user, 'fern')).length, 1);
  assert.equal((await repository.list(user, '', 1, 1)).length, 1);
  assert.equal(await repository.get('DEMO-PLANT-005', user), null);
});

test('demo writes are isolated, duplicate-safe and reset in a new repository', async () => {
  const repository = await createDemoRepository();
  const user = await repository.userById(1);
  const record = await repository.get('DEMO-PLANT-001', user);
  record.commonName = 'Changed outside repository';
  assert.notEqual((await repository.get(record.plantId, user)).commonName, record.commonName);
  await repository.create({ ...record, plantId: 'DEMO-NEW-001' }, user);
  assert.ok(await repository.get('DEMO-NEW-001', user));
  await assert.rejects(repository.create(record, user), { code: 'ER_DUP_ENTRY' });
  const fresh = await createDemoRepository();
  assert.equal(await fresh.get('DEMO-NEW-001', user), null);
});
