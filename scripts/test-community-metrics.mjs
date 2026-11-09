// Start Vite first; uses an external Playwright installation and local mocked transport.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
try {
  for (const touch of [false, true]) {
    const page = await browser.newPage({ hasTouch: touch, viewport: { width: touch ? 390 : 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    const activate = locator => touch ? locator.tap() : locator.click();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/worlds', r => r.fulfill({ json: { worlds: [] } }));
    await page.goto(base);
    const snapshot = await page.evaluate(async () => {
      const { createWorld, applyCommand } = await import('/src/simulation/engine.ts');
      const world = createWorld({ slug: 'metrics', name: 'Metric details', populationCap: 3 }, 0, 42);
      applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 0);
      return { world, presence: [], protected: false, serverNow: Date.now() };
    });
    await page.route('**/api/worlds/metrics', r => r.fulfill({ json: snapshot }));
    await page.routeWebSocket('**/api/worlds/**/socket*', () => {});
    await page.goto(`${base}/w/metrics`);
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: touch && theme === 'dark' ? 320 : touch ? 390 : 1440, height: 900 });
      await page.evaluate(theme => window.kinariumTheme.setPreference(theme), theme);
      if (!touch) {
        const first = page.getByRole('button', { name: /^Togetherness:/ });
        await first.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY + el.clientHeight / 2 - 400));
        const box = await first.boundingBox();
        const cursorX = box.x + box.width / 2;
        await page.mouse.move(cursorX, 200);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.scrollBy(0, 200));
        await page.waitForTimeout(450);
        assert.equal(await page.evaluate(x => document.elementFromPoint(x, 200)?.closest('.metric-trigger')?.getAttribute('aria-expanded'), cursorX), 'false', 'scrolling a stat beneath a stationary pointer does not open it');
        assert.equal(await page.locator('.metric-details').count(), 0);
      }
      for (const label of ['Togetherness', 'Tension', 'Shared resources']) {
        const trigger = page.getByRole('button', { name: new RegExp(`^${label}:`) });
        const panel = page.getByRole('dialog', { name: new RegExp(`^${label}`) });
        await trigger.scrollIntoViewIfNeeded();
        if (!touch) {
          await page.mouse.move(0, 0);
          await trigger.evaluate(el => el.blur());
          await page.waitForTimeout(250); // Let automatic scrolling settle.
          // Passing over a bar never opens its details.
          await trigger.hover(); assert(await panel.isHidden());
          await page.mouse.move(0, 0); await page.waitForTimeout(450);
          assert(await panel.isHidden());
          // A wheel gesture cancels a pending hover, even at a page boundary.
          await trigger.hover(); await page.mouse.wheel(0, 1);
          await page.waitForTimeout(450); assert(await panel.isHidden());
          // Deliberate movement after scrolling allows a fresh hover preview.
          await trigger.hover(); await panel.waitFor();
          await panel.hover(); assert(await panel.isVisible());
          await page.mouse.wheel(0, 1); assert(await panel.isVisible(), 'scrolling inside details keeps them open');
          await page.mouse.move(0, 0); await panel.waitFor({ state: 'hidden' });
          await trigger.hover(); await panel.waitFor();
          await page.evaluate(() => window.scrollBy(0, scrollY > 0 ? -1 : 1));
          await panel.waitFor({ state: 'hidden' });
          await page.waitForTimeout(450); assert(await panel.isHidden(), 'scrolling closes a hover preview without reopening it');
          await trigger.hover(); await panel.waitFor();
          await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
          await page.mouse.move(0, 0); await trigger.evaluate(el => el.blur());
          await trigger.focus(); assert(await panel.isVisible());
          await page.evaluate(() => window.scrollBy(0, scrollY > 0 ? -1 : 1));
          assert(await panel.isVisible(), 'keyboard-opened details survive page scrolling');
          await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
          await page.keyboard.press('Enter'); await panel.waitFor();
        } else { await trigger.tap(); await panel.waitFor(); }
        assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
        await page.evaluate(() => window.scrollBy(0, scrollY > 0 ? -1 : 1));
        assert(await panel.isVisible(), 'clicked or tapped details survive page scrolling');
        assert.match(await panel.innerText(), /Recent changes/);
        assert.match(await panel.innerText(), /A shared meal/);
        await panel.getByText('Read more about how this score works', { exact: true }).click();
        assert.match(await panel.innerText(), /older saves have no backfilled causes/);
        await page.waitForFunction(() => {
          const box = document.querySelector('.metric-details')?.getBoundingClientRect();
          return box && box.x >= 0 && box.right <= innerWidth && box.y >= 0 && box.bottom <= innerHeight;
        });
        const box = await panel.boundingBox(), width = page.viewportSize().width;
        assert(box.x >= 0 && box.x + box.width <= width, `${label} overflows at ${width}`);
        assert(box.y >= 0 && box.y + box.height <= 900, `${label} exceeds viewport height`);
        await page.screenshot({ path: `/tmp/kinarium-metrics-${touch ? 'touch' : 'desktop'}-${theme}.png` });
        await activate(panel.getByRole('button', { name: 'Close score details' }));
        await panel.waitFor({ state: 'hidden' });
        assert(await trigger.evaluate(el => el === document.activeElement));
        // Reopen and dismiss by tapping/clicking outside, then by toggling the trigger.
        await activate(trigger); await panel.waitFor();
        await activate(page.locator('.world-heading h1')); await panel.waitFor({ state: 'hidden' });
        await activate(trigger); await panel.waitFor();
        await activate(trigger); await panel.waitFor({ state: 'hidden' });
      }
      console.log(`PASS: ${touch ? 'touch' : 'desktop'} ${theme} metrics`);
    }
    // Tab can reach each metric; open details can be closed with the keyboard.
    await page.mouse.move(0, 0);
    const first = page.getByRole('button', { name: /^Togetherness:/ });
    await first.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    assert(await first.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Close score details');
    await page.keyboard.press('Enter'); await page.locator('.metric-details').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []); await page.close();
  }
  console.log('PASS: three metrics, brief-hover and scroll guards, deliberate hover/focus, keyboard open/close, touch, toggle/outside/Escape dismissal, actual changes, light/dark, desktop/mobile bounds');
} finally { await browser.close(); }
