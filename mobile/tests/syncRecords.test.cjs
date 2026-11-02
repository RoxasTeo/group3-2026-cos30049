const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function setup(upload) {
 const code = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
 const store = {};
 vm.runInNewContext(code('data/plantRecords.ts'), { exports: store, Date, Set, Error });
 store.openPlantRecords(null, () => {});
 const client = {};
 class RecordsAuthError extends Error {}
 const api = { RecordsAuthError, uploadPlantRecord: (...args) => upload(store, RecordsAuthError, ...args) };
 vm.runInNewContext(code('services/syncRecords.ts'), { exports: client, Error, require: name => name.includes('plantRecordsApi') ? api : name.includes('photoStorage') ? { photoData: async p => p.uri } : store });
 const add = (id, ready = true) => store.savePlantRecord({ plantId: id, commonName: 'Test', scientificName: '', family: '', conservationStatus: '', habitatNotes: '', description: 'Leaf notes', location: { latitude: 3, longitude: 113 }, photos: [{ id: 'photo-one', uri: 'data:image/png;base64,test' }] }, ready);
 return { store, client, add };
}
test('sync skips drafts, retains failed uploads, retries and confirms only accepted records', async () => {
 let offline = true, calls = 0;
 const { store, client, add } = setup(async (store, AuthError, base, token, record, photos) => {
  calls++; assert.equal(token, 'account-token'); assert.equal(photos[0].data, 'data:image/png;base64,test');
  assert.throws(() => store.returnToDraft(record.plantId), /uploading/);
  if (offline) throw new Error('No connection');
  return { ...record, status: 'Synced' };
 });
 add('KEEP-DRAFT', false); add('SEND-ONE');
 assert.match(await client.syncRecords('http://api', 'account-token'), /1 failed/);
 assert.equal(store.getPlantRecord('SEND-ONE').status, 'Failed');
 assert.equal(store.getPlantRecord('KEEP-DRAFT').status, 'Draft');
 offline = false;
 assert.match(await client.syncRecords('http://api', 'account-token'), /1 uploaded/);
 assert.equal(store.getPlantRecord('SEND-ONE').status, 'Synced');
 await client.syncRecords('http://api', 'account-token'); assert.equal(calls, 2);
});
test('account changes discard late upload results and prevent another account receiving the record', async () => {
 const { store, client, add } = setup(async (store, AuthError, base, token, record) => {
  store.resetPlantRecords(); store.openPlantRecords(null, () => {});
  return { ...record, status: 'Synced' };
 });
 add('PRIVATE-ONE'); add('PRIVATE-TWO');
 assert.match(await client.syncRecords('http://api', 'token'), /Account changed/);
 assert.equal(store.getRecordsSnapshot().length, 0);
});
test('expired credentials stop the queue and leave later records pending', async () => {
 const { store, client, add } = setup(async (store, AuthError) => { throw new AuthError('Sign in again'); });
 add('SECOND-ONE'); add('FIRST-ONE');
 assert.match(await client.syncRecords('http://api', 'token'), /Sign in again/);
 assert.equal(store.getPlantRecord('FIRST-ONE').status, 'Failed');
 assert.equal(store.getPlantRecord('SECOND-ONE').status, 'Pending sync');
});
