// Integration test for the mobile API against a running PHP server and a disposable database.
// Never point this at shared or production data: it creates observations and reviews them.
//
// Required accounts (create with Biodiversity-Web/backend/bin/create-user.php, all using TEST_PASSWORD):
//   botanist@test.local (botanist), botanist2@test.local (botanist),
//   officer@test.local (conservation_officer), admin@test.local (admin)
// Required species: scientific name "Dillenia suffruticosa".
//
// Run from mobile/: API_URL=http://127.0.0.1:8099 TEST_PASSWORD=... node --test tests/backendApi.integration.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const base = (process.env.API_URL || 'http://127.0.0.1:8099').replace(/\/+$/, '');
const password = process.env.TEST_PASSWORD;
if (!password) throw new Error('Set TEST_PASSWORD.');
// 1x1 PNG.
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const plantId = `TEST-${Date.now().toString(36).toUpperCase()}`;

async function call(path, { token, body, method = body ? 'POST' : 'GET', headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get('content-type') || '';
  return { status: response.status, type, data: type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) };
}
const login = async email => (await call('/api/mobile/login.php', { body: { email, password } })).data;

test('mobile sign-in issues tokens only to field roles', async () => {
  const session = await login('botanist@test.local');
  assert.match(session.token, /^[a-f0-9]{64}$/);
  assert.ok(session.expiresIn > 0 && session.expiresIn <= 86400);
  assert.equal(session.user.role, 'botanist');
  assert.equal(session.user.password_hash, undefined);
  assert.equal((await call('/api/mobile/login.php', { body: { email: 'admin@test.local', password } })).status, 403);
  assert.equal((await call('/api/mobile/login.php', { body: { email: 'botanist2@test.local', password: 'wrong-password-123' } })).status, 401);
  assert.equal((await call('/api/mobile/plants.php')).status, 401);
  assert.equal((await call('/api/mobile/plants.php', { token: 'f'.repeat(64) })).status, 401);
});

test('browser origins must be allow-listed; native requests send none', async () => {
  assert.equal((await call('/api/mobile/species.php', { headers: { Origin: 'https://evil.example' } })).status, 403);
});

test('field record round trip: upload, retry, list, photo, Web review', async () => {
  const botanist = await login('botanist@test.local');
  const species = await call('/api/mobile/species.php', { token: botanist.token });
  assert.equal(species.status, 200);
  assert.ok(species.data.species.some(s => s.scientificName === 'Dillenia suffruticosa'));

  const record = {
    plantId, commonName: 'Simpoh air', scientificName: 'Dillenia suffruticosa', family: 'Dilleniaceae', conservationStatus: 'Least Concern',
    description: 'Flowering shrub beside the trail.', habitatNotes: 'Forest margin', heightMetres: '2.5', morphology: 'Large leaves, yellow flowers',
    location: { latitude: 3.8130, longitude: 113.7810, accuracy: 8, capturedAt: new Date().toISOString() },
    photos: [{ id: 'photo-1', caption: 'Flower', data: png }],
  };
  const created = await call('/api/mobile/plants.php', { token: botanist.token, body: record });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.record.plantId, plantId);
  assert.equal(created.data.record.status, 'Synced');
  assert.equal(created.data.record.reviewStatus, 'Pending');
  assert.equal(created.data.record.heightMetres, '2.5');
  assert.deepEqual(created.data.record.photos, [{ id: 'photo-1', caption: 'Flower', remoteIndex: 0 }]);

  // A retry after a lost response must not duplicate the observation.
  const retried = await call('/api/mobile/plants.php', { token: botanist.token, body: record });
  assert.equal(retried.status, 200);
  assert.equal(retried.data.record.reference, created.data.record.reference);

  const officer = await login('officer@test.local');
  assert.equal((await call('/api/mobile/plants.php', { token: officer.token, body: { ...record, plantId: `${plantId}-X` } })).status, 403);

  const list = await call('/api/mobile/plants.php?limit=100&offset=0', { token: botanist.token });
  assert.equal(list.status, 200);
  assert.ok(list.data.records.some(r => r.plantId === plantId));

  const photo = await call(`/api/mobile/photo.php?plantId=${plantId}&index=0`, { token: botanist.token });
  assert.equal(photo.status, 200);
  assert.equal(photo.type, 'image/png');
  const other = await login('botanist2@test.local');
  assert.equal((await call(`/api/mobile/photo.php?plantId=${plantId}&index=0`, { token: other.token })).status, 404);
  assert.ok(!(await call('/api/mobile/plants.php', { token: other.token })).data.records.some(r => r.plantId === plantId));

  // The officer reviews the same record through the Web session API.
  const csrf = await fetch(`${base}/auth/csrf.php`, { headers: { Origin: 'http://localhost:5173' } });
  let cookie = csrf.headers.get('set-cookie').split(';')[0];
  const { csrf_token: firstToken } = await csrf.json();
  const web = await fetch(`${base}/auth/login.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': firstToken, Cookie: cookie }, body: JSON.stringify({ email: 'officer@test.local', password }) });
  assert.equal(web.status, 200);
  cookie = web.headers.get('set-cookie').split(';')[0];
  const { csrf_token: token } = await web.json();
  const queue = await (await fetch(`${base}/api/get_observations.php?status=Pending`, { headers: { Cookie: cookie } })).json();
  const observation = queue.observations.find(o => o.plant_tag === plantId);
  assert.ok(observation, 'mobile upload is visible in the Web review queue');
  assert.equal(observation.species_id !== null, true, 'linked to the knowledge-system species');
  const detail = await (await fetch(`${base}/api/get_observation.php?id=${observation.id}`, { headers: { Cookie: cookie } })).json();
  assert.equal(detail.observation.morphology, 'Large leaves, yellow flowers');
  const review = await fetch(`${base}/api/review_observation.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Cookie: cookie },
    body: JSON.stringify({ id: observation.id, version: detail.observation.version, decision: 'Changes requested', notes: 'Add a photo of the fruit.', checks: { notes: true, photos: false, gps: true } }) });
  assert.equal(review.status, 200);

  const after = await call('/api/mobile/plants.php', { token: botanist.token });
  const reviewed = after.data.records.find(r => r.plantId === plantId);
  assert.equal(reviewed.reviewStatus, 'Changes requested');
  assert.equal(reviewed.reviewNotes, 'Add a photo of the fruit.');

  await call('/api/mobile/logout.php', { token: botanist.token, body: {} });
  assert.equal((await call('/api/mobile/plants.php', { token: botanist.token })).status, 401);
});
