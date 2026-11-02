const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const noble = require('@noble/ciphers/aes.js');
function cipher() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/localEncryption.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const expoCrypto = { getRandomBytes: n => new Uint8Array(crypto.randomBytes(n)) };
  vm.runInNewContext(code, { exports, Uint8Array, Error, String, btoa, atob, escape, unescape, encodeURIComponent, decodeURIComponent, require: name => name.includes('noble') ? noble : expoCrypto });
  return exports;
}
const record = JSON.stringify({ records: [{ plantId: 'NIAH-1', description: 'Kantong semar near the cave — 3.81°N', location: { latitude: 3.81, longitude: 113.78 } }], remoteIds: [] });

test('records are sealed with AES-GCM and round-trip, including non-ASCII text', () => {
  const c = cipher(); c.setDeviceKey(new Uint8Array(crypto.randomBytes(32)));
  const sealed = c.sealText(record);
  assert.ok(c.isSealed(sealed));
  assert.ok(!sealed.includes('NIAH-1') && !sealed.includes('113.78'), 'no plaintext in storage');
  assert.notEqual(c.sealText(record), sealed, 'a fresh nonce per save');
  assert.equal(c.openText(sealed), record);
});

test('tampering, a different device key and a missing key are rejected', () => {
  const c = cipher(); c.setDeviceKey(new Uint8Array(32).fill(7));
  const sealed = c.sealText(record);
  const body = Buffer.from(sealed.slice(7), 'base64'); body[20] ^= 1;
  assert.throws(() => c.openText('enc:v1:' + body.toString('base64')), /could not be decrypted/);
  c.setDeviceKey(new Uint8Array(32).fill(8));
  assert.throws(() => c.openText(sealed), /could not be decrypted/);
  c.setDeviceKey(null);
  assert.throws(() => c.openText(sealed), /key is unavailable/);
  assert.throws(() => c.setDeviceKey(new Uint8Array(16)), /invalid/);
});

test('plaintext from earlier app versions is readable so it can be re-saved encrypted', () => {
  const c = cipher(); c.setDeviceKey(new Uint8Array(32).fill(1));
  assert.equal(c.openText(record), record);
  assert.equal(c.isSealed(record), false);
});

test('the format matches expo-crypto combined AES-GCM: nonce, ciphertext, 16-byte tag', () => {
  const key = crypto.randomBytes(32);
  const c = cipher(); c.setDeviceKey(new Uint8Array(key));
  const combined = Buffer.from(c.sealText('hello').slice(7), 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, combined.subarray(0, 12));
  decipher.setAuthTag(combined.subarray(combined.length - 16));
  assert.equal(Buffer.concat([decipher.update(combined.subarray(12, combined.length - 16)), decipher.final()]).toString(), 'hello');
});
