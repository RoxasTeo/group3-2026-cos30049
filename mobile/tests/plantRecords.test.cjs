// Run with: node --test tests/plantRecords.test.cjs (no native runtime needed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.join(__dirname, '../src/data/plantRecords.ts');
function repository() {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date, Set, Number, Error }, { filename });
  return exports;
}
function input(plantId) { return { plantId, commonName: '', scientificName: '', family: '', conservationStatus: 'Not assessed', description: '', habitatNotes: '' }; }
test('searches names and normalized IDs; combines status filter; sorts by update time', () => {
  const r = repository();
  assert.equal(r.selectPlantRecords(r.getRecordsSnapshot(), 'plant-001', 'Pending sync').length, 1);
  assert.equal(r.selectPlantRecords(r.getRecordsSnapshot(), 'MERANTI', 'Draft').length, 0);
  assert.equal(r.selectPlantRecords(r.getRecordsSnapshot(), '  unidentified  ', 'Draft').length, 1);
  const ordered = r.selectPlantRecords(r.getRecordsSnapshot());
  assert.ok(ordered.every((item, i) => i === 0 || Date.parse(ordered[i - 1].updatedAt) >= Date.parse(item.updatedAt)));
});
test('incomplete and unidentified records can be saved; normalized IDs cannot overwrite records', () => {
  const r = repository();
  const saved = r.savePlantRecord(input(' niah-temp-test '));
  assert.equal(saved.commonName, 'Unidentified plant');
  assert.equal(saved.status, 'Draft');
  assert.equal(saved.plantId, 'NIAH-TEMP-TEST');
  assert.throws(() => r.savePlantRecord(input('niah-temp-test')), /already exists/);
  assert.throws(() => r.savePlantRecord(input('invalid id!')), /valid plant ID/);
});
test('ready validation does not save invalid records or invent a GPS fix', () => {
  const r = repository(), before = r.getRecordsSnapshot();
  assert.throws(() => r.savePlantRecord({ ...input('NIAH-TEST-READY'), description: 'Leaf notes' }, true), /GPS/);
  assert.equal(r.getRecordsSnapshot(), before);
  assert.equal(r.readinessIssues({ plantId: 'VALID-ID', description: 'Notes', location: { latitude: 200, longitude: 10 } }).length, 1);
});
test('draft can become pending without a scientific name; non-drafts cannot be edited or deleted', () => {
  const r = repository(), draft = r.getPlantRecord('NIAH-TEMP-004');
  assert.throws(() => r.savePlantRecord(draft, true, 'edit'), /observations/);
  const ready = r.savePlantRecord({ ...draft, description: 'Leaf observations' }, true, 'edit');
  assert.equal(ready.status, 'Pending sync');
  assert.equal(ready.scientificName, '');
  assert.throws(() => r.savePlantRecord(ready, false, 'edit'), /Only drafts/);
  for (const id of ['NIAH-TEMP-004', 'NIAH-PLANT-009', 'NIAH-PLANT-011']) assert.throws(() => r.deletePlantDraft(id), /Only drafts/);
});
test('only drafts can be removed and missing edit targets cannot be resurrected', () => {
  const r = repository();
  const draft = r.savePlantRecord(input('NIAH-DELETE-TEST'));
  r.deletePlantDraft(draft.plantId);
  assert.equal(r.getPlantRecord(draft.plantId), undefined);
  assert.throws(() => r.savePlantRecord(draft, false, 'edit'), /no longer exists/);
});
test('repository notifies subscribers and protects records from caller mutations', () => {
  const r = repository(); let notifications = 0;
  const stop = r.subscribePlantRecords(() => notifications++);
  const saved = r.savePlantRecord(input('NIAH-NOTIFY-TEST'));
  saved.commonName = 'Mutated';
  assert.equal(r.getPlantRecord(saved.plantId).commonName, 'Unidentified plant');
  const sample = r.getPlantRecord('NIAH-TEMP-004'); sample.location.latitude = 0;
  assert.equal(r.getPlantRecord(sample.plantId).location.latitude, 3.81);
  r.deletePlantDraft(saved.plantId); assert.equal(notifications, 2);
  stop(); r.savePlantRecord(input('NIAH-AFTER-STOP')); assert.equal(notifications, 2);
});
test('temporary IDs are unique', () => {
  const r = repository(), ids = new Set(Array.from({ length: 100 }, () => r.createTemporaryPlantId()));
  assert.equal(ids.size, 100);
});
test('photos and GPS survive draft save/edit; explicit removal does not mutate the original', () => {
  const r = repository();
  const photo = { id: 'camera-1', uri: 'file:///session-plant.jpg', caption: 'Leaves', source: 'camera' };
  const location = { latitude: 3.81, longitude: 113.78, accuracy: 8, capturedAt: '2026-10-16T06:00:00Z' };
  const saved = r.savePlantRecord({ ...input('NIAH-CAPTURE-TEST'), photos: [photo], location });
  photo.caption = 'Changed outside repository'; location.latitude = 0;
  assert.equal(r.getPlantRecord(saved.plantId).photos[0].caption, 'Leaves');
  assert.equal(r.getPlantRecord(saved.plantId).location.latitude, 3.81);
  const removed = r.savePlantRecord({ ...saved, photos: [], location: null }, false, 'edit');
  assert.equal(removed.photos.length, 0); assert.equal(removed.location, null);
  assert.equal(saved.photos.length, 1);
});
test('low-accuracy fix can remain a draft but cannot be marked ready; four-photo limit enforced', () => {
  const r = repository();
  const form = { ...input('NIAH-WEAK-FIX'), description: 'Notes', location: { latitude: 3.81, longitude: 113.78, accuracy: 85 } };
  r.savePlantRecord(form);
  assert.throws(() => r.savePlantRecord(form, true, 'edit'), /accuracy is low/);
  const ready = r.savePlantRecord({ ...form, location: { ...form.location, accuracy: 8 } }, true, 'edit');
  assert.equal(ready.status, 'Pending sync');
  assert.throws(() => r.savePlantRecord({ ...input('NIAH-MANY-PHOTOS'), photos: Array.from({ length: 5 }, (_, i) => ({ id: String(i), uri: 'file:///photo.jpg' })) }), /up to 4/);
});

test('signing out resets local preview records instead of exposing another account changes', () => {
  const r = repository();
  const count = r.getRecordsSnapshot().length;
  r.savePlantRecord(input('NIAH-PRIVATE-DRAFT'));
  r.resetPlantRecords();
  assert.equal(r.getRecordsSnapshot().length, count);
  assert.equal(r.getPlantRecord('NIAH-PRIVATE-DRAFT'), undefined);
});
