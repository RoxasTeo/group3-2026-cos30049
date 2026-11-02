import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { createDemoRepository } from '../src/demo-repository.js';
const secret = 'upload-test-only-secret-012345678901234567890';
const token = id => jwt.sign({}, secret, { subject: String(id), issuer: 'niah-api', audience: 'niah-app', expiresIn: '1h' });
test('photo, GPS and morphology upload persists through server restart; retries do not duplicate', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'niah-upload-'));
 let repo;
 try {
   repo = await createDemoRepository(join(dir, 'records.sqlite'));
   let app = await createApp({ repository: repo, secret, mode: 'demo' });
   const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#157333' } }).png().toBuffer();
   const record = { plantId: 'UPLOAD-TEST-1', description: 'Observed serrated leaves', heightMetres: '1.5', morphology: 'Serrated margin', location: { latitude: 3.81, longitude: 113.78, accuracy: 8 }, photos: [{ id: 'photo-one', data: `data:image/png;base64,${image.toString('base64')}`, caption: 'Leaf detail' }] };
   const result = await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(record).expect(201);
   assert.match(result.body.record.photos[0].uri, /^data:image\/jpeg;base64,/);
   const retry = await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(record).expect(200);
   assert.equal(retry.body.record.createdAt, result.body.record.createdAt);
   await request(app).post('/api/plants').auth(token(2), { type: 'bearer' }).send(record).expect(409);
   await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send({ ...record, heightMetres: '2' }).expect(409);
   repo.close(); repo = await createDemoRepository(join(dir, 'records.sqlite'));
   app = await createApp({ repository: repo, secret, mode: 'demo' });
   const saved = await request(app).get('/api/plants/UPLOAD-TEST-1').auth(token(1), { type: 'bearer' }).expect(200);
   assert.equal(saved.body.record.heightMetres, '1.5'); assert.equal(saved.body.record.morphology, 'Serrated margin');
   assert.equal(saved.body.record.photos[0].caption, 'Leaf detail');
   assert.equal(saved.body.record.location.accuracy, 8);
   await request(app).get('/api/plants/UPLOAD-TEST-1').auth(token(2), { type: 'bearer' }).expect(404);
   await request(app).get('/api/plants/UPLOAD-TEST-1').expect(401);
   const bad = { ...record, plantId: 'BAD-PHOTO-1', photos: [{ id: 'one', data: 'data:image/png;base64,YmFk' }] };
   await request(app).post('/api/plants').auth(token(1), { type: 'bearer' }).send(bad).expect(400);
 } finally { repo?.close(); await rm(dir, { recursive: true, force: true }); }
});
