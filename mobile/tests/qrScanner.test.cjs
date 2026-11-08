const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const exported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/services/qrScannerAdapter.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exported,URL,decodeURIComponent});
test('plant tags accept IDs, prefixed IDs and record URLs',()=>{
 for(const value of ['demo-plant-001',' plant:DEMO-PLANT-001 ','https://example.test/plant/DEMO-PLANT-001?source=qr','niah-biodiversity://plant/DEMO-PLANT-001']) assert.equal(exported.plantIdFromQr(value),'DEMO-PLANT-001');
});
test('unrelated payloads and malformed tags are rejected',()=>{
 for(const value of ['', 'ab', 'hello world', 'javascript:alert(1)', 'https://example.test/', 'https://example.test/%ZZ', 'a'.repeat(65)]) assert.equal(exported.plantIdFromQr(value),null);
});


test('shared observation QR codes resolve exact server IDs', () => {
 assert.equal(exported.plantIdFromQr('plant:OBS:123'), 'OBS:123');
 assert.equal(exported.plantIdFromQr('https://example.test/plant/OBS%3A123'), 'OBS:123');
 assert.equal(exported.plantIdFromQr('plant:OBS:0'), null);
});
