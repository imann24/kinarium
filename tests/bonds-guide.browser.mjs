// Local fixture only. Optional AXE_PATH points to an external axe-core install.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
let snapshot, socket;
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
async function cards(n) { await page.waitForFunction(n => document.querySelectorAll('.bond-card').length === n, n); }
async function audit(selector) {
  if (!process.env.AXE_PATH) return;
  await page.addScriptTag({ path: process.env.AXE_PATH });
  const result = await page.evaluate(async selector => window.axe.run(document.querySelector(selector), { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21aa'] } }), selector);
  assert.deepEqual(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
}
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld, relationship } = await import('/src/simulation/engine.ts');
    const world = createWorld({ slug: 'bonds-guide', name: 'Bonds guide', populationCap: 3 }, Date.now(), 42);
    Object.assign(relationship(world, 'c1', 'c2'), { encounters: 4, affinity: 50, trust: 72 });
    Object.assign(relationship(world, 'c1', 'c3'), { encounters: 2, affinity: -40, trust: 20 });
    return { type: 'snapshot', world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/bonds-guide`);
  await page.getByRole('button', { name: 'Bonds', exact: true }).click();
  await cards(2);
  const relationships = JSON.stringify(snapshot.world.relationships);
  for (const [first, second, count] of [[false,true,1],[true,false,0],[true,true,0],[false,true,1],[false,false,2]]) {
    snapshot.world.characters[0].away = first; snapshot.world.characters[1].away = second;
    socket.send(JSON.stringify(snapshot)); await cards(count);
    assert.equal(JSON.stringify(snapshot.world.relationships), relationships);
  }
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await audit('.world-sidebar');
      const opener = page.getByRole('button', { name: 'Field guide' });
      await opener.focus(); await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'A world with no finish line.' });
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /that exact thread/);
      const details = dialog.locator('summary');
      await details.focus(); await page.keyboard.press('Enter');
      assert.match(await dialog.innerText(), /240 requests per UTC day/);
      assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      await audit('dialog');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      assert.equal(await details.evaluate(el => el === document.activeElement), true);
      assert.equal(await page.evaluate(() => !!document.activeElement.closest('dialog')), true);
      await page.screenshot({ path: `/tmp/kinarium-guide-${theme}-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await opener.evaluate(el => el === document.activeElement), true);
    }
  }
  snapshot.world.characters[1].away = true;
  await page.goto(`${origin}/w/bonds-guide/insights?connections=close`);
  await page.getByLabel('Explore connections').waitFor();
  assert.equal(await page.locator('.insights-bond').count(), 0);
  await page.getByLabel('Current statistics for').selectOption('all');
  await page.locator('.insights-bond').first().waitFor();
  assert.match(await page.locator('.insights-bond').innerText(), /away/);
  await page.getByLabel('Explore connections').selectOption('strained');
  assert.match(await page.locator('.insights-bond').innerText(), /Trust 20/);
  assert.deepEqual(errors, []);
  console.log('PASS: live presence changes, both away, restored bonds, unchanged relationship records, Insights scope/filters, guide keyboard/focus/Escape, responsive light/dark 1440/390/320, axe WCAG A/AA when configured, no page errors');
} finally { await browser.close(); }
