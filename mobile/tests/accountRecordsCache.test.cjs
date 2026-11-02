const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/services/accountRecordsCache.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const cache = {}; vm.runInNewContext(code, { exports: cache, Error });
const user = { id: 1, email: 'one@example.test' };
const key = url => `niah.records.v1:${url}:1:one@example.test`;
test('cache migration preserves original, isolates accounts and keeps existing destination', () => {
 const raw = JSON.stringify({ records: [{ plantId: 'DRAFT' }], remoteIds: [] });
 const data = new Map([[key('old'), raw]]);
 const storage = { read: k => data.get(k) ?? null, write: (k, v) => data.set(k, v) };
 assert.equal(cache.readAccountRecords(user, 'new', 'old', storage).raw, raw);
 assert.equal(data.get(key('old')), raw);
 data.set(key('new'), 'existing');
 assert.equal(cache.readAccountRecords(user, 'new', 'old', storage).raw, 'existing');
 assert.equal(cache.readAccountRecords({ id: 2, email: 'two@example.test' }, 'new', 'old', storage).raw, null);
});
test('disabled migration, corrupted data and disk failures preserve source data', () => {
 const raw = JSON.stringify({ records: [], remoteIds: [] });
 const storage = { read: k => k === key('old') ? raw : null, write: () => { throw new Error('Disk full'); } };
 assert.equal(cache.readAccountRecords(user, 'new', null, storage).raw, null);
 assert.throws(() => cache.readAccountRecords(user, 'new', 'old', storage), /Disk full/);
 assert.equal(storage.read(key('old')), raw);
 assert.throws(() => cache.readAccountRecords(user, 'new', 'old', { ...storage, read: k => k === key('old') ? '{}' : null }), /Original data was kept/);
});
