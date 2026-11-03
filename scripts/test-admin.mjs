// Disposable local fixtures only. Run against a fresh isolated Wrangler store.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import WebSocket from 'ws';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:8794';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local fixtures only');
const password = process.env.KINARIUM_ADMIN_PASSWORD;
assert(password, 'Supply the local test server secret through the environment');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
const suffix = Date.now().toString(36); const slug = `admin-delete-${suffix}`, keep = `admin-keep-${suffix}`;
const output = process.env.SCREENSHOT_DIR || '/tmp/kinarium-admin-screenshots'; await mkdir(output, { recursive: true });
let ws;
try {
  for (const fixture of [slug, keep]) assert.equal((await context.request.post(base + '/api/worlds', { data: { slug: fixture, name: fixture === slug ? 'Disposable admin house' : 'Preserved neighbor', mode: 'persistent' } })).status(), 201);
  const before = await (await context.request.get(`${base}/api/worlds/${keep}`)).json();
  assert.equal((await context.request.get(base + '/api/admin/houses')).status(), 401);
  assert.equal((await context.request.post(`${base}/api/admin/houses/${slug}/delete`, { data: { confirmation: slug }, headers: { Origin: base } })).status(), 401);
  await page.goto(base + '/admin');
  await page.getByLabel('Admin password', { exact: true }).fill('wrong'); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Incorrect admin password' }).waitFor();
  assert.equal(await page.getByLabel('Admin password', { exact: true }).inputValue(), '');
  await page.getByLabel('Admin password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const card = page.locator('.admin-houses li').filter({ has: page.getByRole('heading', { name: 'Disposable admin house', exact: true }) });
  await card.getByRole('button', { name: 'Delete…', exact: true }).click();
  const button = page.getByRole('button', { name: 'Permanently delete house', exact: true });
  assert(await button.isDisabled());
  await page.locator('#admin-confirmation').fill(keep); assert(await button.isDisabled());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal((await context.request.get(`${base}/api/worlds/${slug}`)).status(), 200);
  await card.getByRole('button', { name: 'Delete…', exact: true }).click(); await page.locator('#admin-confirmation').fill(slug);
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(theme => window.kinariumTheme.setPreference(theme), theme);
    await page.screenshot({ path: `${output}/${width}-${theme}.png`, fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  console.log('PASS: sign-in, confirmation, cancel, responsive screenshots');
  // Exercise a retryable partial-cleanup response in the UI, then real cleanup.
  await page.route(`**/api/admin/houses/${slug}/delete`, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Cleanup pending; retry this slug.', status: 'pending' }) }));
  await button.click(); await page.getByRole('alert').filter({ hasText: 'Cleanup pending' }).waitFor();
  assert.equal(await page.locator('#admin-confirmation').inputValue(), slug);
  await page.unroute(`**/api/admin/houses/${slug}/delete`);
  console.log('PASS: partial-cleanup response keeps confirmation available');
  // Bound the local proxy's TCP close-handshake wait; the received close code
  // must still be the server's deletion code (1008), never a timeout (1006).
  ws = new WebSocket(`${base.replace('http', 'ws')}/api/worlds/${slug}/socket`, { headers: { Origin: base }, closeTimeout: 2000 });
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  console.log('PASS: live socket opened');
  const closed = new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Deleted house socket did not close')), 10000); ws.once('close', (code, reason) => { clearTimeout(timeout); resolve({ code, reason: String(reason) }); }); });
  assert.equal((await context.request.post(`${base}/api/admin/houses/${slug}/delete`, { data: { confirmation: keep }, headers: { Origin: base } })).status(), 400);
  assert.equal((await context.request.post(`${base}/api/admin/houses/${slug}/delete`, { data: { confirmation: slug }, headers: { Origin: 'https://evil.test' } })).status(), 403);
  await button.click(); await page.getByRole('status').filter({ hasText: `Deleted ${slug}` }).waitFor();
  console.log('PASS: real deletion acknowledged');
  assert.equal((await closed).code, 1008);
  for (const tail of ['', '/history']) assert.equal((await context.request.get(`${base}/api/worlds/${slug}${tail}`)).status(), 410);
  assert.equal((await context.request.post(`${base}/api/admin/houses/${slug}/delete`, { data: { confirmation: slug }, headers: { Origin: base } })).status(), 200);
  assert.equal((await context.request.post(base + '/api/worlds', { data: { slug, name: 'Cannot reset' } })).status(), 409);
  const after = await (await context.request.get(`${base}/api/worlds/${keep}`)).json();
  assert.equal(after.world.createdAt, before.world.createdAt); assert.deepEqual(after.world.characters.map(c => c.id), before.world.characters.map(c => c.id));
  await context.request.get(base + '/api/worlds');
  assert.equal((await context.request.post(`${base}/api/admin/houses/the-common-house/delete`, { data: { confirmation: 'the-common-house' }, headers: { Origin: base } })).status(), 200);
  const list = await (await context.request.get(base + '/api/worlds')).json(); assert(!list.worlds.some(w => w.slug === 'the-common-house' || w.slug === slug));
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => /admin|password/i.test(k))), []);
  assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage).filter(k => /admin|password/i.test(k))), []);
  await page.reload(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  assert.equal((await context.request.get(base + '/api/admin/houses')).status(), 401);
  assert.deepEqual(errors, []);
  console.log(`PASS: browser sign-in, exact confirmation, cancel, pending retry, CSRF, socket closure, idempotent deletion, isolation, no reseeding, reload/logout, no browser credential storage, desktop/mobile light/dark. Screenshots: ${output}`);
} finally { ws?.close(); await browser.close(); }
