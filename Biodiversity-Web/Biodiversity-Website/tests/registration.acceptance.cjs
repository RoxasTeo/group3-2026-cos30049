const {chromium}=require('playwright');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {execFileSync}=require('node:child_process');const path=require('node:path');
const base=process.env.REVIEW_TEST_WEB_URL||'';
if(process.env.REVIEW_TEST_FIXTURES!=='1'||!/^http:\/\/localhost:\d+$/.test(base))throw Error('Disposable localhost test environment required');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const email='auth-acceptance-'+randomUUID().replaceAll('-','')+'@review.test';
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.goto(base+'/#/register');
 await page.getByLabel('Full name',{exact:true}).fill('Registration acceptance');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Acceptance-Only-2026!');await page.getByLabel('Confirm password',{exact:true}).fill('Different-password-2026!');await page.getByRole('button',{name:'Register',exact:true}).click();await page.getByRole('alert').getByText('Passwords do not match. Enter the same password in both fields.',{exact:true}).waitFor();
 await page.getByLabel('Confirm password',{exact:true}).fill('Acceptance-Only-2026!');
 const registered=page.waitForResponse(r=>r.url().includes('/auth/register.php')&&r.request().method()==='POST');await page.getByRole('button',{name:'Register',exact:true}).click();assert.equal((await registered).status(),201);
 await page.waitForURL(u=>u.hash==='#/login?registered=1');await page.getByText('Account created. Sign in with your new account.',{exact:true}).waitFor();
 await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill('Wrong-password-2026!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('alert').getByText('Invalid email or password',{exact:true}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('Acceptance-Only-2026!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.hash==='#/species-dashboard');
 const me=await(await context.request.get(base+'/auth/me.php')).json();assert.equal(me.user.role,'user');assert.equal(me.user.email,email);assert(!JSON.stringify(me).includes('password_hash'));
 await page.goto(base+'/#/admin/users');await page.waitForURL(u=>u.hash==='#/access-denied');await page.goto(base+'/#/species-dashboard');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(u=>u.hash==='#/login');assert.equal((await context.request.get(base+'/auth/me.php')).status(),401);
 const api=await browser.newContext();const token=await(await api.request.get(base+'/auth/csrf.php')).json();
 for(let i=0;i<5;i++){const r=await api.request.post(base+'/auth/login.php',{headers:{'X-CSRF-Token':token.csrf_token},data:{email,password:'Wrong-password-2026!'}});assert.equal(r.status(),401)}
 const blocked=await api.request.post(base+'/auth/login.php',{headers:{'X-CSRF-Token':token.csrf_token},data:{email,password:'Acceptance-Only-2026!'}});assert.equal(blocked.status(),429);assert(Number(blocked.headers()['retry-after'])>0);
 assert.deepEqual(errors,[]);console.log('PASS registration + auth browser: mismatch feedback, successful registration redirect, success notice, wrong/correct login, General User role, protected admin route, logout and five-attempt throttle. Synthetic account removed.');
}finally{await browser.close();execFileSync(process.env.REVIEW_TEST_PHP,[path.resolve(__dirname,'../../backend/tests/cleanup_auth.php'),email])}
})().catch(e=>{console.error(e);process.exit(1)});
