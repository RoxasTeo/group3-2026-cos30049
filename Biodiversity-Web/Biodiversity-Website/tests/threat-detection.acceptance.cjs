const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const base=process.env.REVIEW_TEST_WEB_URL||'',device=process.env.REVIEW_TEST_URL||'';
if(process.env.REVIEW_TEST_FIXTURES!=='1'||![base,device].every(u=>/^http:\/\/localhost:\d+$/.test(u)))throw Error('Disposable localhost test services required');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let id;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const token=await(await context.request.get(base+'/auth/csrf.php')).json();
  const login=await(await context.request.post(base+'/auth/login.php',{headers:{'X-CSRF-Token':token.csrf_token},data:{email:'officer@review.test',password:'Review-Test-Only-2026!'}})).json();
  const created=await context.request.post(base+'/api/add_species.php',{headers:{'X-CSRF-Token':login.csrf_token},data:{common_name:'Monitoring acceptance automatic browser',scientific_name:'Threatus browser',family:'Testaceae',description:'Fictional automatic alert browser fixture'}});
  assert.equal(created.status(),201);id=(await created.json()).species_id;
  const submit=async humidity=>{
   const response=await context.request.post(device+'/api/add_sensor_reading.php',{headers:{'X-Device-Key':process.env.REVIEW_TEST_DEVICE_KEY},data:{species_id:id,temperature:40,humidity,distance_cm:100,latitude:3.81,longitude:113.78}});
   assert.equal(response.status(),201);return response.json();
  };
  assert.equal((await submit(70)).automatic_alerts[0].rule,'temperature_high');
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(base+'/#/monitoring');
  const rules=page.locator('.detection-rules');await rules.getByText('Enabled',{exact:true}).waitFor();
  await rules.getByText('View current thresholds',{exact:true}).click();
  await rules.getByRole('cell',{name:'Temperature',exact:true}).waitFor();
  const table=page.locator('table').filter({has:page.getByRole('columnheader',{name:'Threat Type',exact:true})});
  await table.getByText('Automatic [temperature_high]: temperature 40 °C above configured range.',{exact:true}).waitFor();
  const second=await submit(10);assert.equal(second.automatic_alerts.length,1);assert.equal(second.automatic_alerts[0].rule,'humidity_low');
  await page.clock.fastForward(30000);
  await table.getByText('Automatic [humidity_low]: humidity 10 % below configured range.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: real sensor API → automatic database alerts → monitoring table after 30s refresh; thresholds visible. Synthetic readings, no hardware.');
 }finally{
  await browser.close();
  if(id)execFileSync(process.env.REVIEW_TEST_PHP,[path.resolve(__dirname,'../../backend/tests/cleanup_monitoring.php'),String(id)]);
 }
})().catch(e=>{console.error(e);process.exit(1)});
