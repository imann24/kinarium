// Start the local app first. Uses an existing Playwright/Chromium installation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.SCREENSHOT_DIR || '/tmp/kinarium-house-narrative';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const snapshot = await (await page.request.get(`${base}/api/worlds/the-common-house`)).json();
  snapshot.world.minute = 1000;
  const [a, b] = snapshot.world.characters;
  snapshot.world.history = [{ id: 50, minute: 900, kind: 'conflict', characters: [a.id, b.id], text: 'Do not render this unsupported motive.' }];
  await page.route('**/api/worlds/the-common-house', route => route.fulfill({ json: snapshot }));
  await page.routeWebSocket('**/api/worlds/**/socket*', () => {});
  await page.goto(`${base}/w/the-common-house/insights`, { waitUntil: 'domcontentloaded' });
  const narrative = page.getByRole('region', { name: 'A little of the story.' });
  await narrative.waitFor();
  assert.match(await narrative.innerText(), /recorded disagreement/);
  assert.doesNotMatch(await narrative.innerText(), /unsupported motive/);
  assert.match(await narrative.innerText(), /Records may be incomplete/);
  const before = await narrative.innerText();
  await page.getByLabel('Current statistics for').selectOption('all');
  assert.equal(await narrative.innerText(), before);
  const disclosure = narrative.locator('summary');
  await disclosure.focus(); await page.keyboard.press('Enter');
  assert.match(await narrative.innerText(), /Older entries are outside this snapshot/);
  assert.match(await narrative.innerText(), /including recorded interactions with residents now away/);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Color theme').selectOption(theme);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width} overflow`);
      await narrative.screenshot({ path: `${output}/${theme}-${width}.png` });
    }
  }
  snapshot.world.history = []; snapshot.world.characters.forEach(c => c.away = true);
  await page.reload({ waitUntil: 'domcontentloaded' }); await narrative.waitFor();
  assert.match(await narrative.innerText(), /Nobody is at home/);
  assert.match(await narrative.innerText(), /does not mean none occurred/);
  await narrative.locator('summary').click();
  assert.match(await narrative.innerText(), /No journal entries are available yet/);
  assert.deepEqual(errors, []);
  console.log('PASS: grounded narrative, visible coverage, independent scope, keyboard disclosure, empty/away-only state, light/dark at 1440/768/390/320px, no page errors');
} finally { await browser.close(); }
