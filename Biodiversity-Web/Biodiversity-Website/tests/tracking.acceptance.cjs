const {chromium}=require('playwright');const assert=require('node:assert/strict');const{execFileSync}=require('node:child_process');const path=require('node:path');
const base=process.env.REVIEW_TEST_WEB_URL||'';
if(process.env.REVIEW_TEST_FIXTURES!=='1'||!/^http:\/\/localhost:\d+$/.test(base))throw Error('Disposable localhost required');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let species;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050}});const token=await(await context.request.get(base+'/auth/csrf.php')).json();const login=await(await context.request.post(base+'/auth/login.php',{headers:{'X-CSRF-Token':token.csrf_token},data:{email:'officer@review.test',password:'Review-Test-Only-2026!'}})).json();
  species=(await(await context.request.post(base+'/api/add_species.php',{headers:{'X-CSRF-Token':login.csrf_token},data:{common_name:'Tracking acceptance browser',scientific_name:'Trackus browser',family:'Testaceae',description:'Fictional tracking browser fixture'}})).json()).species_id;
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(base+'/#/tracking');await page.getByRole('heading',{name:'Plant & sensor tracking',exact:true}).waitFor();
  const suffix=Date.now().toString(36).toUpperCase(),tag='TRACK-TEST-P-'+suffix,code='TRACK-TEST-D-'+suffix;
  const plant=page.locator('#plant-form');await plant.getByLabel('Plant tag',{exact:true}).fill(tag);await plant.getByLabel('Plant label',{exact:true}).fill('Fictional individual plant');await plant.getByLabel('Plant species',{exact:true}).selectOption(String(species));await plant.getByLabel('Registered latitude',{exact:true}).fill('3.81');await plant.getByLabel('Registered longitude',{exact:true}).fill('113.78');await plant.getByRole('button',{name:'Save plant',exact:true}).click();await page.getByRole('cell',{name:tag,exact:true}).waitFor();
  const device=page.locator('#device-form');await device.getByLabel('Device code',{exact:true}).fill(code);await device.getByLabel('Device name',{exact:true}).fill('Fictional forest sensor');await device.getByRole('button',{name:'Save device',exact:true}).click();
  await page.getByRole('heading',{name:'Save this device key'}).waitFor();const key=await page.locator('.tracking-key').innerText();assert.match(key,/^[a-f0-9]{64}$/);await page.getByRole('button',{name:'I have saved the key'}).click();
  let data=await(await context.request.get(base+'/api/get_tracking.php')).json();const p=data.plants.find(p=>p.plant_tag===tag),d=data.devices.find(d=>d.device_code===code);assert(p&&d);assert(!JSON.stringify(data).includes(key));
  await page.getByLabel('Assignment device',{exact:true}).selectOption(String(d.id));await page.getByLabel('Assignment plant',{exact:true}).selectOption(String(p.id));await page.getByRole('button',{name:'Assign device',exact:true}).click();
  await page.getByRole('row').filter({has:page.getByRole('cell',{name:new RegExp(code)})}).getByRole('button',{name:'Unassign',exact:true}).waitFor();
  for(const lat of[3.8101,3.8102]){const r=await context.request.post(base+'/api/submit_device_reading.php',{headers:{'X-Device-Key':key},data:{device_code:code,temperature:25,humidity:70,distance_cm:100,latitude:lat,longitude:113.7802}});assert.equal(r.status(),201)}
  await page.getByRole('button',{name:'Refresh tracking',exact:true}).click();await page.getByLabel('Inspect device',{exact:true}).selectOption(String(d.id));await page.locator('.tracking-inspector').getByText(/Reported GPS: 3.8102000/).waitFor();
  assert(await page.locator('.tracking-map .leaflet-interactive').count()>=3);
  await page.getByText('Assignment history',{exact:true}).click();await page.locator('.tracking-inspector li').getByText(new RegExp(tag)).waitFor();
  if(process.env.TRACKING_SCREENSHOT_DIR){await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:path.join(process.env.TRACKING_SCREENSHOT_DIR,'plant-tracking-desktop.png'),fullPage:false})}
  const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:new RegExp(code)})});await row.getByRole('button',{name:'Edit',exact:true}).click();await device.getByLabel('Device name',{exact:true}).fill('Paused fictional sensor');await device.getByRole('checkbox',{name:'Device enabled'}).uncheck();await device.getByRole('button',{name:'Save device',exact:true}).click();await row.getByRole('cell',{name:'Paused',exact:true}).waitFor();
  await row.getByRole('button',{name:'Unassign',exact:true}).click();await row.getByRole('cell',{name:'Unassigned',exact:true}).waitFor();
  const rejected=await context.request.post(base+'/api/submit_device_reading.php',{headers:{'X-Device-Key':key},data:{device_code:code,temperature:25,humidity:70,distance_cm:100,latitude:3.81,longitude:113.78}});assert.equal(rejected.status(),401);

  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('PASS tracking browser: register plant/device, one-time key, assign, real keyed uploads, map markers/trail, history, edit/pause/unassign and 390px layout. Synthetic fixtures only.');
 }finally{await browser.close();if(species)execFileSync(process.env.REVIEW_TEST_PHP,[path.resolve(__dirname,'../../backend/tests/cleanup_tracking.php'),String(species)])}
})().catch(e=>{console.error(e);process.exit(1)});
