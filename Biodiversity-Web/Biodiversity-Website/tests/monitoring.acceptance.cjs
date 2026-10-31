const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const context=await browser.newContext();
  const base=process.env.REVIEW_TEST_WEB_URL||'';
  if(process.env.REVIEW_TEST_FIXTURES!=='1'||!/^http:\/\/localhost:\d+$/.test(base))throw Error('Disposable localhost Web test environment required');
  const token=await(await context.request.get(base+'/auth/csrf.php')).json();
  await context.request.post(base+'/auth/login.php',{headers:{'X-CSRF-Token':token.csrf_token},data:{email:'officer@review.test',password:'Review-Test-Only-2026!'}});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let calls=0,fail=false;
  await page.route('**/api/get_sensor_readings.php',route=>{calls++;return route.fulfill({status:fail?500:200,json:fail?{error:'Test outage'}:[{reading_id:1,species_id:42,temperature:20+calls,humidity:70,distance_cm:10,latitude:3.81,longitude:113.78,recorded_at:'2026-10-31 06:00:00'}]})});
  await page.route('**/api/get_threat_alerts.php',route=>route.fulfill({json:[{alert_id:1,species_id:42,alert_type:'motion',severity:'warning',message:'Browser monitoring fixture',latitude:3.81,longitude:113.78,created_at:'2026-10-31 06:00:00'}]}));
  await page.clock.install();
  await page.goto(base+'/#/monitoring');
  await page.getByText('21.0',{exact:false}).first().waitFor(); assert.equal(calls,1);
  await page.clock.fastForward(30000);await page.getByText('22.0',{exact:false}).first().waitFor();assert.equal(calls,2);
  const toggle=page.getByRole('checkbox',{name:'Auto-refresh every 30 seconds'});
  await toggle.uncheck();await page.clock.fastForward(60000);assert.equal(calls,2);
  await page.getByRole('button',{name:'Refresh Data',exact:true}).click();await page.getByText('23.0',{exact:false}).first().waitFor();assert.equal(calls,3);
  await toggle.check();await page.getByText('24.0',{exact:false}).first().waitFor();
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.clock.fastForward(60000);assert.equal(calls,4);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});
  await page.getByText('25.0',{exact:false}).first().waitFor();assert.equal(calls,5);
  fail=true;await page.clock.fastForward(30000);
  await page.getByText('Refresh failed. Showing the last successfully loaded data; it may be out of date.',{exact:true}).waitFor();
  assert.equal(calls,6);assert(await page.getByText('25.0',{exact:false}).first().isVisible());
  fail=false;await page.clock.fastForward(30000);await page.getByText('27.0',{exact:false}).first().waitFor();
  await page.getByRole('link',{name:'Species management',exact:false}).click();await page.waitForURL(u=>u.hash==='#/species');
  const finalCalls=calls;await page.clock.fastForward(60000);assert.equal(calls,finalCalls);
  assert.deepEqual(errors,[]);
  console.log('PASS monitoring browser: initial load, 30s refresh, pause toggle, manual refresh, hidden-tab pause/resume, stale-data error/recovery, unmount cleanup. Responses simulated; no physical device claimed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
