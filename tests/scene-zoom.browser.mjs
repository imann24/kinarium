// Local app with deterministic snapshots; no live-world writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const viewBox = page => page.locator('.world-stage svg.building').evaluate(el => el.getAttribute('viewBox').split(' ').map(Number));
const zoomOf = box => 856 / box[2];

async function open(context, theme) {
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let snapshot;
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
  await page.routeWebSocket('**/socket?**', () => {});
  await page.goto(base);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const world = createWorld({ slug: 'zoom', name: 'Zoom house', populationCap: 3 }, Date.now(), 42);
    return { world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${base}/w/zoom`);
  await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
  await page.locator('.world-stage svg.building').waitFor();
  return { page, errors };
}

try {
  for (const [width, theme] of [[390, 'light'], [320, 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 700 }, hasTouch: true, isMobile: true });
    const { page, errors } = await open(context, theme);
    const cdp = await context.newCDPSession(page);
    const svg = page.locator('.world-stage svg.building');
    const box = await svg.boundingBox();
    // Pinch around a resident so they stay under the fingers.
    const sprite = page.locator('.resident-sprite').first();
    const spriteAt = async () => { const b = await sprite.locator('ellipse').first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const [cx, cy] = await spriteAt();
    assert(cy > box.y && cy < box.y + box.height);
    const heightBefore = box.height;
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });

    // Two fingers spreading apart zoom the house, not the page.
    await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
    for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 30 - i * 3, cy], [cx + 30 + i * 3, cy]]);
    await touch('touchEnd', []);
    const pinched = await viewBox(page);
    assert(Math.abs(zoomOf(pinched) - 2) < 0.05, `pinch zoom ${zoomOf(pinched)}`);
    assert.equal(await page.evaluate(() => visualViewport.scale), 1);
    assert.equal((await svg.boundingBox()).height, heightBefore, 'the canvas keeps its size while zoomed');
    await page.getByRole('button', { name: 'Reset zoom' }).waitFor();
    // Phone name tags drop their legibility boost as the scene itself grows.
    assert.match(await page.locator('.resident-name-tag').first().evaluate(el => getComputedStyle(el).transform), /^matrix\(1\.5/);
    assert.equal(await page.locator('.resident-sprite.selected').count(), 0, 'a pinch does not select a resident');
    await page.screenshot({ path: `/tmp/kinarium-zoom-${width}-${theme}.png` });

    // One finger drags the zoomed house.
    await touch('touchStart', [[cx, cy]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx + i * 5, cy + i * 3]]);
    await touch('touchEnd', []);
    const panned = await viewBox(page);
    assert(panned[0] < pinched[0] && panned[1] < pinched[1], `pan ${pinched} -> ${panned}`);
    assert.equal(await page.locator('.resident-sprite.selected').count(), 0, 'a pan does not select a resident');

    // A tap on a resident still selects them while zoomed.
    const [tx, ty] = await spriteAt();
    assert(tx > box.x && tx < box.x + box.width && ty > box.y && ty < box.y + box.height, 'the resident is still in view');
    await page.touchscreen.tap(tx, ty);
    await page.locator('.resident-sprite.selected').waitFor();

    await page.getByRole('button', { name: 'Reset zoom' }).tap();
    await page.waitForFunction(() => document.querySelector('.world-stage svg.building').getAttribute('viewBox') === '32 24 856 594');
    // Phones zoom by pinching, so the toolbar only offers the way back.
    assert.equal(await page.getByRole('button', { name: 'Zoom in' }).isVisible(), false);
    assert.equal(await page.locator('.scene-zoom-controls').isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await context.close();
  }

  // Desktop: a trackpad pinch (ctrl+wheel) zooms at the cursor and a mouse drag pans without selecting.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, errors } = await open(context, 'light');
  const box = await page.locator('.world-stage svg.building').boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
  await page.keyboard.down('Control');
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -20);
  await page.keyboard.up('Control');
  const zoomed = await viewBox(page);
  assert(zoomOf(zoomed) > 1.5, `wheel zoom ${zoomOf(zoomed)}`);
  assert.equal(await page.evaluate(() => scrollY), 0, 'ctrl+wheel does not scroll the page');
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  const dragged = await viewBox(page);
  assert(dragged[0] < zoomed[0], `drag ${zoomed} -> ${dragged}`);
  assert.equal(await page.locator('.resident-sprite.selected').count(), 0);
  await page.screenshot({ path: '/tmp/kinarium-zoom-desktop.png' });
  await page.getByRole('button', { name: 'Reset zoom' }).click();
  await page.waitForFunction(() => document.querySelector('.world-stage svg.building').getAttribute('viewBox') === '32 24 856 594');
  assert.equal(await page.getByRole('button', { name: 'Zoom out' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.waitForFunction(() => Math.abs(856 / Number(document.querySelector('.world-stage svg.building').getAttribute('viewBox').split(' ')[2]) - 1.5) < 0.01);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('scene zoom ok');
} finally {
  await browser.close();
}
