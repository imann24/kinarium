// Local fixtures only; no live world writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
let snapshot;
await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
await page.routeWebSocket('**/socket?**', () => {});
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { refreshResidentSummaries } = await import('/src/simulation/resident-summary.ts');
    const world = createWorld({ slug: 'summary-browser', name: 'Memory summaries' }, Date.now(), 42);
    world.characters[0].memories = [{ eventId: 999, minute: 1, kind: 'friendship', participantIds: [world.characters[1].id], text: 'An original memory kept intact.' }];
    world.characters[1].memories = []; world.characters[1].away = true;
    world.characters[2].memories = [{ text: 'My earlier saved words.', minute: 1 }];
    refreshResidentSummaries(world, 1000);
    world.characters[0].memories.push({ text: 'A new memory waiting.', minute: 1 });
    return { world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/summary-browser`);
  await page.getByRole('button', { name: 'Residents', exact: true }).click();
  await page.locator('.resident-row').filter({ hasText: snapshot.world.characters[0].name }).click();
  const panel = page.locator('.personal-history');
  await panel.waitFor();
  assert.match(await panel.innerText(), /I became friends with/);
  assert.match(await panel.innerText(), /waiting for the next refresh/);
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      const retained = panel.locator('.history-retained > summary');
      await retained.focus(); await page.keyboard.press('Enter');
      const original = panel.locator('.history-retained .history-source summary').first();
      await original.focus(); await page.keyboard.press('Enter');
      assert.match(await panel.innerText(), /An original memory kept intact/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await panel.evaluate(e => e.scrollWidth <= e.clientWidth), true);
      await page.keyboard.press('Enter'); await retained.focus(); await page.keyboard.press('Enter');
    }
  }
  await page.screenshot({ path: '/tmp/resident-summary-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'All residents' }).click();
  await page.locator('.resident-row').filter({ hasText: snapshot.world.characters[2].name }).click();
  assert.match(await panel.innerText(), /original words/);
  await page.getByRole('button', { name: 'All residents' }).click();
  await page.getByRole('button', { name: 'Away · 1', exact: true }).click();
  await page.locator('.resident-row').first().click();
  assert.match(await panel.innerText(), /Their lived history will grow/);
  assert.deepEqual(errors, []);
  console.log('PASS: prose, pending freshness, originals, legacy and empty away profiles; keyboard disclosures; light/dark 1440/390/320px; no overflow or page errors');
} finally { await browser.close(); }
