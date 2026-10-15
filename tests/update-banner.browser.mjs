// Run against a local production preview: pnpm exec vite preview --host 127.0.0.1
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const current = await (await fetch(`${origin}/build-version.json`)).json();
  let version = current; let requests = 0; let failed = false;
  await page.route('**/api/worlds', route => route.fulfill({ json: { worlds: [] } }));
  await page.route('**/api/version?*', route => {
    requests++;
    return route.fulfill({ status: failed ? 503 : 200, json: { ...version, nonce: new URL(route.request().url()).searchParams.get('nonce') } });
  });
  await page.clock.install(); await page.goto(origin);
  const banner = page.getByRole('complementary', { name: 'Site update' });
  const tick = async () => { await page.clock.runFor(25_000); await page.waitForTimeout(50); };
  assert.equal(requests, 0); await tick(); assert.equal(requests, 1); assert.equal(await banner.count(), 0);
  version = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', builtAt: current.builtAt + 1000 };
  await tick(); await tick(); assert.equal(await banner.count(), 0);
  failed = true; await tick(); failed = false;
  await tick(); await tick(); assert.equal(await banner.count(), 0);
  await tick(); await banner.waitFor(); assert.equal(requests, 7);
  for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.setViewportSize({ width, height: 900 });
    const box = await banner.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width);
    assert.equal(await banner.evaluate(e => e.scrollWidth <= e.clientWidth), true);
    const button = banner.getByRole('button', { name: 'Refresh to update' });
    assert((await button.boundingBox()).height >= 44);
    await button.focus(); assert.equal(await button.evaluate(e => e === document.activeElement), true);
  }
  await page.getByRole('textbox', { name: 'Search worlds' }).fill('unsaved search');
  page.once('dialog', d => { assert.match(d.message(), /unsaved changes/); void d.dismiss(); });
  await banner.getByRole('button').click();
  assert.equal(await page.getByRole('textbox', { name: 'Search worlds' }).inputValue(), 'unsaved search');
  page.once('dialog', d => void d.accept());
  await Promise.all([page.waitForEvent('framenavigated'), banner.getByRole('button').click()]);
  assert.equal(await banner.count(), 0); assert.deepEqual(errors, []);
  console.log('Production banner: cadence, same/new versions, errors, confirmation, keyboard, mobile and both themes passed.');
  if (process.env.DEV_ORIGIN) {
    const dev = process.env.DEV_ORIGIN; assert(['localhost', '127.0.0.1'].includes(new URL(dev).hostname));
    const devPage = await browser.newPage(); let checks = 0;
    await devPage.route('**/api/**', route => { if (route.request().url().includes('/api/version')) checks++; return route.fulfill({ json: { worlds: [] } }); });
    await devPage.clock.install(); await devPage.goto(dev); await devPage.clock.runFor(100_000);
    assert.equal(checks, 0); assert.equal(await devPage.locator('.update-banner').count(), 0);
    console.log('Development mode: no version checks or banner.');
  }
} finally { await browser.close(); }
