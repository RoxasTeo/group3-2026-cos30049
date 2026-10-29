const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function client(fetch) {
  const filename = path.join(__dirname, '../src/auth/loginRequest.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, fetch, AbortController, setTimeout, clearTimeout, Date, Error });
  return exports.loginRequest;
}
test('login sends normalized email, retains password, and accepts server roles', async () => {
  for (const role of ['botanist', 'conservation-officer']) {
    const login = client(async (url, options) => {
      assert.equal(url, 'http://localhost:3000/api/auth/login');
      assert.deepEqual(JSON.parse(options.body), { email: 'botanist@example.com', password: 'Exact Password!' });
      return { ok: true, status: 200, json: async () => ({ token: 'test-token', expiresIn: 3600, user: { id: 1, name: 'Test User', email: 'botanist@example.com', role } }) };
    });
    const result = await login('http://localhost:3000/api', ' Botanist@Example.com ', 'Exact Password!');
    assert.equal(result.user.role, role);
    assert.ok(result.expiresAt > Date.now());
  }
});
test('wrong passwords, rate limits, network failures and unknown roles are rejected', async () => {
  for (const [status, expected] of [[401, /Incorrect email/], [429, /Too many/], [500, /unavailable/]]) {
    await assert.rejects(client(async () => ({ status, ok: false }))('http://test/api', 'a@b.com', 'pw'), expected);
  }
  await assert.rejects(client(async () => { throw new Error('offline'); })('http://test/api', 'a@b.com', 'pw'), /Cannot reach/);
  await assert.rejects(client(async () => ({ status: 200, ok: true, json: async () => ({ token: 'token', expiresIn: 3600, user: { id: 1, name: 'Test', email: 'a@b.com', role: 'admin' } }) }))('http://test/api', 'a@b.com', 'pw'), /invalid account/);
});
