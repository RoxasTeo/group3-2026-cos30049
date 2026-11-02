const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function client(fetch) {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/services/plantRecordsApi.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,fetch,AbortController,setTimeout,clearTimeout,Date,Set,Error}); return exports;
}
const example = {...require('./record-fixtures.json')[2], plantId:'DEMO-001'};
test('fetches all pages with authentication and keeps server sample labels',async()=>{
 const urls=[];
 const c=client(async(url, options)=>{
  assert.equal(options.headers.Authorization,'Bearer account-token');urls.push(url);
  return {ok:true,status:200,json:async()=>({records:urls.length===1?Array.from({length:100},(_,i)=>({...example,plantId:`DEMO-${i}`})):[{...example,plantId:'DEMO-LAST'}]})};
 });
 const result=await c.fetchPlantRecords('http://localhost/api','account-token');
 assert.equal(result.length,101);assert.equal(urls[0],'http://localhost/api/mobile/plants.php?limit=100&offset=0');assert.ok(urls[1].endsWith('offset=100'));assert.equal(result[0].sample,true);
});
test('rejects expired sessions, malformed pages and duplicate pages',async()=>{
 const expired=client(async()=>({status:401,ok:false}));
 await assert.rejects(expired.fetchPlantRecords('http://api','token'),expired.RecordsAuthError);
 const invalid=client(async()=>({status:200,ok:true,json:async()=>({records:[{plantId:'BAD'}]})}));
 await assert.rejects(invalid.fetchPlantRecords('http://api','token'),/invalid/);
 const duplicate=client(async()=>({status:200,ok:true,json:async()=>({records:[example,example]})}));
 await assert.rejects(duplicate.fetchPlantRecords('http://api','token'),/changed/);
});
test('empty accounts return no samples; network and later-page failures reject the entire load',async()=>{
 assert.equal((await client(async()=>({ok:true,json:async()=>({records:[]})})).fetchPlantRecords('http://api','token')).length,0);
 await assert.rejects(client(async()=>{throw new Error('offline');}).fetchPlantRecords('http://api','token'),/connection/);
 let calls=0;
 const c=client(async()=>++calls===1?{ok:true,json:async()=>({records:Array.from({length:100},(_,i)=>({...example,plantId:`DEMO-${i}`}))})}:{ok:false,status:500});
 await assert.rejects(c.fetchPlantRecords('http://api','token'),/server/);
});

test('uploads only field data and photographs and requires server confirmation', async () => {
 const c = client(async (url, options) => {
   assert.equal(options.headers.Authorization, 'Bearer test-token');
   const body = JSON.parse(options.body);
   assert.equal(body.status, undefined); assert.equal(body.sample, undefined);
   assert.equal(body.photos[0].data, 'data:image/jpeg;base64,abc');
   assert.equal(body.location.sample, undefined);
   return { ok: true, status: 201, json: async () => ({ record: example }) };
 });
 assert.equal((await c.uploadPlantRecord('http://api', 'test-token', example, [{ id: 'one', data: 'data:image/jpeg;base64,abc', caption: '' }])).plantId, example.plantId);
 const denied = client(async () => ({ ok: false, status: 401 }));
 await assert.rejects(denied.uploadPlantRecord('http://api', 'token', example, []), denied.RecordsAuthError);
 const conflict = client(async () => ({ ok: false, status: 409, json: async () => ({ error: 'ID conflict' }) }));
 await assert.rejects(conflict.uploadPlantRecord('http://api', 'token', example, []), /ID conflict/);
 const wrong = client(async () => ({ ok: true, json: async () => ({ record: { ...example, plantId: 'OTHER-ID' } }) }));
 await assert.rejects(wrong.uploadPlantRecord('http://api', 'token', example, []), /confirm/);
});
