// Start Vite first. Uses an existing Playwright/Chromium installation.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/worlds', route => route.fulfill({ json: { worlds: [] } }));
  await page.goto(base);
  // Build the fixture with the actual simulation and a non-default cap.
  const snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    return { world: createWorld({ slug: 'capacity', name: 'Capacity', populationCap: 3 }, 0, 42), presence: [], protected: false, serverNow: Date.now() };
  });
  await page.route('**/api/worlds/capacity', route => route.fulfill({ json: snapshot }));
  await page.routeWebSocket('**/api/worlds/**/socket*', () => {});
  await page.goto(`${base}/w/capacity`);
  await page.getByRole('button', { name: 'Residents', exact: true }).click();
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.kinariumTheme.setPreference(theme), theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const selector of ['.stage-footer', '.resident-list']) {
        const wrapper = page.locator(`${selector} .introduce-control`);
        const button = wrapper.locator('button');
        const tooltip = wrapper.getByRole('tooltip', { includeHidden: true });
        assert(await button.isDisabled());
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await tooltip.waitFor({ state: 'visible' });
        assert.match(await tooltip.innerText(), /house is full.*limit is 3 residents/);
        assert.equal(await wrapper.getAttribute('aria-describedby'), await tooltip.getAttribute('id'));
        const palette = await tooltip.evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, fg: getComputedStyle(el).color }));
        assert.equal(palette.bg, theme === 'dark' ? 'rgb(34, 45, 38)' : 'rgb(255, 254, 248)');
        assert.notEqual(palette.bg, palette.fg);
        const tipBox = await tooltip.boundingBox();
        assert(tipBox.x >= 0 && tipBox.x + tipBox.width <= width, `${theme} ${width} tooltip overflow`);
        // Moving onto the tooltip keeps it readable; Escape dismisses it.
        await tooltip.hover();
        assert(await tooltip.isVisible());
        await wrapper.focus();
        await page.keyboard.press('Escape');
        assert(await tooltip.isHidden());
        await page.mouse.move(0, 0);
        await wrapper.evaluate(el => el.blur());
        // Reach the wrapper through the actual Tab order.
        await wrapper.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        assert(await wrapper.evaluate(el => el === document.activeElement));
        assert(await tooltip.isVisible());
        await page.keyboard.press('Enter'); await page.keyboard.press('Space');
        assert.equal(await page.getByRole('dialog').count(), 0);
        await page.keyboard.press('Tab');
        assert(await tooltip.isHidden());
        const rect = await wrapper.boundingBox();
        assert(rect.x >= 0 && rect.x + rect.width <= width, `${theme} ${width} wrapper overflow`);
      }
    }
  }
  // Away residents free a slot; increasing the cap also removes the explanation.
  for (const freeSlot of ['away', 'cap']) {
    snapshot.world.characters[0].away = freeSlot === 'away';
    snapshot.world.settings.populationCap = freeSlot === 'cap' ? 7 : 3;
    await page.reload();
    await page.getByRole('button', { name: 'Residents', exact: true }).click();
    for (const wrapper of await page.locator('.introduce-control').all()) {
      assert(await wrapper.locator('button').isEnabled());
      assert.equal(await wrapper.getAttribute('tabindex'), null);
      await wrapper.hover();
      assert.equal(await wrapper.getByRole('tooltip', { includeHidden: true }).count(), 0);
    }
    await page.locator('.stage-footer .introduce-resident').click();
    await page.getByRole('dialog').waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: both introduction buttons, disabled hover, keyboard focus, Escape, no activation at capacity, light/dark at desktop/mobile, away residents and changed cap, enabled action');
} finally { await browser.close(); }
