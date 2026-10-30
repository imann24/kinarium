// Local rendering only; no server/world writes. Run against pnpm dev:client.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/stack-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/client/design-tokens.css"><link rel="stylesheet" href="/src/client/style.css"><link rel="stylesheet" href="/src/client/theme.css"></head><body><div id="fixture" style="width:100%"></div></body></html>' }));
await page.route('**/api/**', route => route.abort());
try {
  await page.goto(`${origin}/stack-fixture`);
  await page.evaluate(async () => {
    const { default: RefreshRuntime } = await import('/@react-refresh');
    RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: { createRoot } } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { default: Building } = await import('/src/client/Building.tsx');
    const { createWorld } = await import('/src/simulation/engine.ts');
    const root = createRoot(document.querySelector('#fixture'));
    window.world = createWorld({ slug: 'stacks', name: 'Stack fixture', populationCap: 3 }, 0, 42);
    window.world.characters.forEach(c => Object.assign(c, { floor: 0, destination: 1, x: 94, inElevator: true }));
    window.draw = () => root.render(React.createElement(Building, { world: structuredClone(window.world), onSelect: id => window.selected = id }));
    window.draw();
  });
  const badge = page.locator('[data-stack-count]');
  await badge.waitFor();
  assert.equal(await badge.count(), 1); assert.equal(await badge.getAttribute('data-stack-count'), '2');
  assert.equal(await badge.evaluate(e => e.closest('[data-resident-id]').dataset.residentId), 'c3');
  assert.match(await page.locator('[data-resident-id="c3"]').getAttribute('aria-label'), /2 additional residents at the same position/);
  await page.locator('[data-resident-id="c3"]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.selected), 'c3');
  // Actual DOM paint order changes, then a resident leaves and returns.
  await page.evaluate(() => { window.world.characters.reverse(); window.draw(); });
  await page.waitForFunction(() => document.querySelector('[data-stack-count]')?.closest('[data-resident-id]').dataset.residentId === 'c1');
  await page.evaluate(() => { window.world.characters[0].away = true; window.draw(); });
  await page.waitForFunction(() => document.querySelector('[data-stack-count]')?.dataset.stackCount === '1');
  await page.evaluate(() => { window.world.characters[0].away = false; window.draw(); });
  await page.waitForFunction(() => document.querySelector('[data-stack-count]')?.dataset.stackCount === '2');
  for (const theme of ['light', 'dark']) for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const metrics = await badge.evaluate(g => {
      const text = g.querySelector('text'), rect = g.querySelector('rect');
      const t = text.getBBox(), r = rect.getBBox();
      return { fits: t.x >= r.x && t.x + t.width <= r.x + r.width && t.y >= r.y && t.y + t.height <= r.y + r.height,
        fill: getComputedStyle(text).fill, background: getComputedStyle(rect).fill,
        size: text.getBoundingClientRect().height };
    });
    assert(metrics.fits); assert.notEqual(metrics.fill, metrics.background); assert(metrics.size >= 10);
    const bounds = await badge.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
    await page.screenshot({ path: `/tmp/resident-stacks-${theme}-${width}.png`, fullPage: true });
  }
  // A moving cabin stays stacked, and an exit snapshot retains the count until
  // the visible residents actually leave the cabin, then loses it as they part.
  await page.evaluate(() => { window.world.minute += 2; window.world.elevatorFloor = 1; window.world.characters.forEach(c => c.floor = 1); window.draw(); });
  await page.waitForTimeout(300);
  assert.equal(await badge.getAttribute('data-stack-count'), '2');
  await page.evaluate(async () => {
    const { separateStandingResidents } = await import('/src/simulation/standing.ts');
    window.world.minute += 2; window.world.characters.forEach(c => { c.inElevator = false; c.x = 84; });
    separateStandingResidents(window.world); window.draw();
  });
  await page.waitForTimeout(100); assert.equal(await badge.getAttribute('data-stack-count'), '2');
  await badge.waitFor({ state: 'detached' });
  // Unavoidable outside stack on reload, then a genuinely nearby distinct person.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.world.characters.forEach(c => c.x = 40); window.draw(); });
  await badge.waitFor(); assert.equal(await badge.getAttribute('data-stack-count'), '2');
  await page.evaluate(() => { window.world.characters[0].x = 41; window.draw(); });
  await page.waitForFunction(() => document.querySelector('[data-stack-count]')?.dataset.stackCount === '1');
  await page.evaluate(() => { window.world.characters[1].x = 42; window.draw(); });
  await badge.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS: actual SVG order, +1/+2, absence/return, keyboard labels, light/dark at 1440/390/320px, animated cabin/exit, outside stacks and nearby exclusion; no page errors');
} finally { await browser.close(); }
