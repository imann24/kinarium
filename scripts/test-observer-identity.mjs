// Run against pnpm dev; supports PLAYWRIGHT_MODULE and CHROMIUM_PATH.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const errors = [];
const open = p => p.getByRole('button', { name: 'Your observer name and online players' }).click();
const self = p => p.locator('.presence-row').filter({ hasText: 'You ·' });
const close = p => p.getByRole('button', { name: 'Close dialog', exact: true }).click();
const rename = async (p, name) => { await p.getByLabel('Your observer name', { exact: true }).fill(name); await p.getByRole('button', { name: 'Save name' }).click(); await open(p); };
const until = async (check) => { for (let n = 0; n < 100; n++) { if (await check()) return; await new Promise(r => setTimeout(r, 100)); } assert.fail('Timed out waiting for observer state'); };
try {
  const a = await browser.newContext(), b = await browser.newContext();
  await a.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.testSockets = [];
    window.WebSocket = class extends NativeSocket { constructor(...args) { super(...args); window.testSockets.push(this); } };
  });
  for (const [context, id] of [[a, 'observer-a'], [b, 'observer-b']]) await context.addInitScript(({ id }) => {
    if (!localStorage.getItem('kinarium-player')) localStorage.setItem('kinarium-player', JSON.stringify({ id, name: 'Same name' }));
  }, { id });
  const page = await a.newPage(), other = await b.newPage(), tab = await a.newPage();
  for (const p of [page, other, tab]) p.on('pageerror', e => errors.push(e.message));
  const slug = `test-observer-${Date.now().toString(36)}`;
  const created = await a.request.post(base + '/api/worlds', { data: { slug, name: 'Observer test' } });
  assert.equal(created.status(), 201);
  const url = `${base}/w/${slug}`;
  await page.goto(url); await other.goto(url); await tab.goto(url + '/insights');
  for (const p of [page, other, tab]) await open(p);
  await until(async () => await page.locator('.presence-row').count() === 2);
  for (const p of [page, other, tab]) { assert.equal(await self(p).count(), 1); assert.match(await self(p).innerText(), /Same name/); }
  // Fail reconnect requests: the locally saved name must still change immediately.
  const worldRoute = `**/api/worlds/${slug}`;
  await page.route(worldRoute, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test reconnect unavailable"}' }));
  await rename(page, 'First rename');
  assert.match(await self(page).innerText(), /First rename/);
  await until(async () => (await self(page).innerText()).includes('reconnecting'));
  await until(async () => (await self(tab).innerText()).includes('First rename'));
  await until(async () => (await other.locator('.presence-row').allTextContents()).some(t => t.includes('First rename') && !t.includes('You ·')));
  assert.match(await self(other).innerText(), /Same name/);
  // A stale GET containing the old name must not roll back local identity.
  const stale = await (await b.request.get(base + `/api/worlds/${slug}`)).json();
  stale.presence = stale.presence.map(p => p.id === 'observer-a' ? { ...p, name: 'Same name' } : p);
  await page.unroute(worldRoute);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requested = false;
  await page.route(worldRoute, async route => { requested = true; await gate; await route.fulfill({ json: stale }).catch(() => {}); });
  await rename(page, 'Second rename');
  await until(() => requested);
  assert.match(await self(page).innerText(), /Second rename/);
  release();
  await until(async () => (await self(page).innerText()).includes('You · observing'));
  assert.match(await self(page).innerText(), /Second rename/);
  await page.unroute(worldRoute);
  await page.evaluate(stale => {
    const old = window.testSockets.find(socket => socket.url.includes('/api/worlds/'));
    old.onmessage({ data: JSON.stringify({ ...stale, type: 'snapshot', world: { ...stale.world, name: 'Stale socket world' } }) });
    old.onclose();
  }, stale);
  assert.match(await page.locator('.world-heading h1').innerText(), /Observer test/);
  assert.match(await self(page).innerText(), /You · observing/);
  await until(async () => (await other.locator('.presence-row').allTextContents()).some(t => t.includes('Second rename')));
  // Disconnect every tab for the current identity, then reconnect with the saved name.
  await a.setOffline(true);
  for (const p of [page, tab]) await p.evaluate(() => window.testSockets.filter(socket => socket.url.includes('/api/worlds/')).forEach(socket => socket.close()));
  await until(async () => (await self(page).innerText()).includes('reconnecting'));
  await rename(page, 'Offline rename');
  assert.match(await self(page).innerText(), /Offline rename/);
  await a.setOffline(false);
  await until(async () => (await self(page).innerText()).includes('You · observing'));
  await until(async () => (await other.locator('.presence-row').allTextContents()).some(t => t.includes('Offline rename')));
  await page.reload(); await open(page);
  assert.match(await self(page).innerText(), /Offline rename/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kinarium-player')).id), 'observer-a');
  // Same name as another observer must still mark exactly one self row.
  await rename(page, 'Same name');
  await until(async () => (await other.locator('.presence-row').allTextContents()).every(t => t.includes('Same name')));
  assert.equal(await self(page).count(), 1); assert.equal(await self(other).count(), 1);
  await rename(page, '   '); assert.match(await self(page).innerText(), /Wandering observer/);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  await page.screenshot({ path: '/tmp/kinarium-observer-mobile.png' });
  // A blocked persistence write must not prevent an in-session rename.
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); }; });
  await rename(page, 'Session only');
  assert.match(await self(page).innerText(), /Session only/);
  await close(page);
  assert.deepEqual(errors, []);
  console.log('PASS: independent sessions, stable-ID You label, duplicate names, immediate rename, same-browser tabs/Insights, failed reconnect, delayed stale response, offline rename/reconnect, persistence, blank name, responsive UI.');
} finally { await browser.close(); }
