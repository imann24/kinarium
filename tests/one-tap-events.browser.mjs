// Local app with deterministic snapshots on a touch phone; no live-world writes.
import assert from 'node:assert/strict';
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width, height: 844 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let snapshot; const commands = [];
    await page.route('**/api/**', route => {
      const request = route.request();
      if (request.url().endsWith('/commands')) commands.push(request.postDataJSON());
      return route.fulfill({ json: request.url().endsWith('/worlds') ? { worlds: [] } : snapshot });
    });
    await page.routeWebSocket('**/socket?**', () => {});
    await page.goto(base);
    snapshot = await page.evaluate(async () => {
      const { createWorld } = await import('/src/simulation/engine.ts');
      return { world: createWorld({ slug: 'one-tap', name: 'One tap', populationCap: 2 }, Date.now(), 7), presence: [], serverNow: Date.now() };
    });
    await page.goto(`${base}/w/one-tap`);
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const card = page.getByRole('button', { name: /A shared meal/ });
    await card.scrollIntoViewIfNeeded();
    await assert.doesNotReject(card.waitFor({ state: 'visible' }));
    await page.waitForFunction(() => !document.querySelector('.event-card')?.disabled);
    assert.equal(await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), false, 'phone has no fine hover');
    assert.equal(await card.evaluate(el => getComputedStyle(el).touchAction), 'manipulation');
    await card.tap();
    await page.waitForTimeout(200);
    assert.deepEqual(commands, [{ type: 'trigger-event', eventId: 'shared-meal' }], `${theme} ${width}px: one tap triggers the event once`);
    assert.equal(await card.evaluate(el => getComputedStyle(el).transform), 'none', 'no hover lift left behind after the tap');
    assert.deepEqual(errors, []);
    if (process.env.SCREENSHOT && theme === 'light' && width === 390) await page.screenshot({ path: process.env.SCREENSHOT });
    await context.close();
  }
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  assert.equal(await desktop.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), true, 'desktop keeps the hover lift');
  console.log('one-tap events: passed at 320/390px light and dark');
} finally { await browser.close(); }
