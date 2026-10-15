// Local fixture only: no requests or commands reach a live world.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
let snapshot;
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
await page.routeWebSocket('**/socket?**', () => {});
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld, applyCommand } = await import('/src/simulation/engine.ts');
    const world = createWorld({ slug: 'state-browser', name: 'Resident causes' }, Date.now(), 42);
    const c = world.characters[0];
    c.name = 'Cleo'; c.mood = 99;
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, Date.now());
    Object.assign(c, { floor: 1, destination: 1, mood: 0, energy: 100, belonging: 19 });
    world.resources = 4; world.tension = 100;
    // Another resident represents a legacy save, with no attribution data.
    delete world.characters[1].stateChanges;
    world.characters[2].away = true;
    return { world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/state-browser`);
  await page.getByRole('button', { name: 'Residents', exact: true }).click();
  await page.locator('.resident-row').filter({ hasText: 'Cleo' }).click();
  const panel = page.getByRole('region', { name: 'What affects these values' });
  await panel.waitFor();
  assert.match(await panel.innerText(), /At 0 · downward pressure/);
  assert.match(await panel.innerText(), /Energy · At 100 · upward pressure/);
  assert.match(await panel.innerText(), /Energy does not directly change mood/);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      const numbers = panel.locator('summary').first();
      await numbers.focus(); await page.keyboard.press('Enter');
      assert.match(await panel.innerText(), /supplies −0.2, belonging −0.0155, tension −0.025/);
      assert.match(await panel.innerText(), /change after limits 0/);
      await page.keyboard.press('Enter');
      const recent = panel.locator('summary').last();
      await recent.focus(); await page.keyboard.press('Space');
      assert.match(await panel.innerText(), /A shared meal/);
      assert.match(await panel.innerText(), /Mood \+1 · Energy 0 · Belonging 0/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await panel.evaluate(e => e.scrollWidth <= e.clientWidth), true);
      await page.keyboard.press('Space');
    }
  }
  await page.screenshot({ path: '/tmp/resident-state-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'All residents' }).click();
  await page.locator('.resident-row').filter({ hasText: snapshot.world.characters[1].name }).click();
  await panel.locator('summary').last().click();
  assert.match(await panel.innerText(), /Older saves have no backfilled causes/);
  await page.getByRole('button', { name: 'All residents' }).click();
  await page.getByRole('button', { name: 'Away · 1', exact: true }).click();
  await page.locator('.resident-row').first().click();
  assert.match(await panel.innerText(), /While away, mood, energy and belonging are paused/);
  assert.equal(await panel.locator('summary').count(), 1);
  await page.goto(`${origin}/w/state-browser/insights`);
  await page.locator('.insights-resident').filter({ hasText: 'Cleo' }).click();
  await panel.waitFor();
  assert.match(await panel.innerText(), /Scarce supplies push mood down/);
  assert.deepEqual(errors, []);
  console.log('PASS: state causes, capped deltas, legacy saves, away residents, insights profile, keyboard disclosure, light/dark at 1440/390/320px, no page errors');
} finally { await browser.close(); }
