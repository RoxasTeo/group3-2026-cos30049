const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.REVIEW_TEST_WEB_URL || '';
if (process.env.REVIEW_TEST_FIXTURES !== '1' || !/^http:\/\/localhost:\d+$/.test(base)) throw Error('Use REVIEW_TEST_FIXTURES=1 and REVIEW_TEST_WEB_URL=http://localhost:<disposable-web-port>');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [];
  let id, officerContext;
  async function account(name) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    const token = await (await context.request.get(base + '/auth/csrf.php')).json();
    await context.request.post(base + '/auth/login.php', { headers: { 'X-CSRF-Token': token.csrf_token }, data: { email: name + '@review.test', password: 'Review-Test-Only-2026!' } });
    return context;
  }
  try {
    const anon = await browser.newPage();
    for (const path of ['/species-dashboard', '/admin/users', '/reports', '/distribution', '/observations']) {
      await anon.goto(base + '/#' + path);
      await anon.waitForURL(url => url.hash.startsWith('#/login'));
    }
    // Exercise actual login form and preserve reports return destination.
    await anon.goto(base + '/#/reports');
    await anon.waitForURL(url => url.hash.startsWith('#/login'));
    await anon.getByLabel('Email address').fill('officer@review.test');
    await anon.getByLabel('Password', { exact: true }).fill('Review-Test-Only-2026!');
    await anon.getByRole('button', { name: 'Sign in', exact: true }).click();
    await anon.waitForURL(url => url.hash === '#/reports');
    officerContext = await account('officer');
    const page = await officerContext.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/#/admin/users');
    await page.waitForURL(url => url.hash === '#/access-denied');
    await page.goto(base + '/#/species/new');
    await page.getByLabel('Common name *', { exact: true }).fill('Browser acceptance plant');
    await page.getByLabel('Scientific name *', { exact: true }).fill('Testus browser');
    await page.getByLabel('Family *', { exact: true }).fill('Browseraceae');
    await page.getByLabel('Description *', { exact: true }).fill('Browser field description / 中文');
    // Use an actual valid image, then verify photo removal no longer throws.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a+U8AAAAASUVORK5CYII=', 'base64');
    await page.locator('input[type=file]').setInputFiles({ name: 'acceptance.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Remove photograph' }).click();
    assert.equal(await page.getByText('acceptance.png', { exact: true }).count(), 0);
    await page.locator('input[type=file]').setInputFiles({ name: 'acceptance.png', mimeType: 'image/png', buffer: png });
    const created = page.waitForResponse(r => r.url().includes('/api/add_species.php') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save species' }).click();
    const response = await created;
    assert.equal(response.status(), 201);
    id = (await response.json()).species_id;
    await page.waitForURL(url => url.hash === '#/species');
    await page.getByRole('searchbox').fill('Testus browser');
    await page.getByRole('link', { name: 'Browser acceptance plant' }).click();
    await page.getByRole('link', { name: 'Edit species', exact: true }).click();
    await page.getByRole('button', { name: 'Remove photograph' }).click();
    await page.getByLabel('Common name *', { exact: true }).fill('Edited browser acceptance plant');
    await page.getByRole('button', { name: 'Save species' }).click();
    await page.waitForURL(url => url.hash === '#/species');
    await page.getByRole('searchbox').fill('Edited browser acceptance');
    await page.getByRole('link', { name: 'Edited browser acceptance plant' }).click();
    await page.getByText('No photograph added', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete species', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await officerContext.request.get(base + '/api/get_species.php?id=' + id)).status(), 200);
    await page.getByRole('button', { name: 'Delete species', exact: true }).click();
    await page.getByRole('button', { name: 'Delete record', exact: true }).click();
    await page.waitForURL(url => url.hash === '#/species');
    assert.equal((await officerContext.request.get(base + '/api/get_species.php?id=' + id)).status(), 404);
    id = null;
    assert.equal(await page.locator('.demo-note').count(), 0);
    const user = await account('user');
    const up = await user.newPage();
    await up.goto(base + '/#/species-dashboard');
    await up.getByRole('searchbox').waitFor();
    for (const path of ['/species/new', '/admin/users', '/reports', '/distribution', '/observations']) {
      await up.goto(base + '/#' + path);
      await up.waitForURL(url => url.hash === '#/access-denied');
    }
    const admin = await account('admin');
    const ap = await admin.newPage();
    await ap.goto(base + '/#/admin/users');
    await ap.getByRole('heading', { name: /User|Profile/i }).first().waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS browser: anonymous protection, real login + redirect, role routes, photo add/remove, create/edit/search/delete confirmation, user knowledge page and admin access');
  } finally {
    if (id && officerContext) {
      const token = await (await officerContext.request.get(base + '/auth/me.php')).json();
      await officerContext.request.post(base + '/api/delete_species.php?id=' + id, { headers: { 'X-CSRF-Token': token.csrf_token }, data: {} });
    }
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
