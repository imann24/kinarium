// Local app with deterministic snapshots on a touch phone; no live-world writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  let count = 0;
  for (const width of [390, 320]) for (const theme of ['light', 'dark']) for (const mode of ['normal', 'fullscreen']) {
    const context = await browser.newContext({ viewport: { width, height: 700 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let snapshot;
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
    await page.routeWebSocket('**/socket?**', () => {});
    await page.goto(base);
    snapshot = await page.evaluate(async () => {
      const { createWorld } = await import('/src/simulation/engine.ts');
      const { beginConversation } = await import('/src/simulation/conversations.ts');
      const world = createWorld({ slug: 'phone', name: 'Phone reading', populationCap: 2 }, Date.now(), 42);
      const [a, b] = world.characters;
      a.x = 90; b.x = 80; a.floor = b.floor = a.destination = b.destination = 0; a.name = 'Cleo';
      const entry = beginConversation(world, a, b, true);
      a.speech = 'I want this to change too, but I need us to talk about what happened in the kitchen before anything else moves.';
      entry.conversation.turns[0].text = a.speech;
      return { world, presence: [], serverNow: Date.now() };
    });
    await page.goto(`${base}/w/phone`);
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    if (mode === 'fullscreen') { await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).tap(); await page.locator('.world-fullscreen').waitFor(); }
    const preview = page.locator('.speech-box .expandable-text');
    await preview.tap();
    const sheet = page.locator('.speech-sheet');
    await sheet.waitFor();
    await sheet.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
    // The full line reads at body size, entirely inside the viewport, with large touch targets.
    assert.equal(await preview.getAttribute('aria-expanded'), 'true');
    assert.equal(await preview.textContent(), snapshot.world.characters[0].speech);
    const box = await sheet.boundingBox();
    assert(box.x >= 8 && box.x + box.width <= width - 8 && box.y >= 0 && box.y + box.height <= 700, JSON.stringify(box));
    const size = await preview.evaluate(el => { const r = el.getBoundingClientRect(); return { font: parseFloat(getComputedStyle(el).fontSize), scale: r.width / el.offsetWidth, outline: getComputedStyle(el).outlineStyle }; });
    assert(size.font >= 16 && Math.abs(size.scale - 1) < .01, JSON.stringify(size));
    assert.equal(size.outline, 'none', 'A tap does not draw the keyboard focus ring');
    const close = page.getByRole('button', { name: "Dismiss Cleo's speech" });
    const target = await close.boundingBox();
    assert(target.width >= 44 && target.height >= 44, JSON.stringify(target));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
    if (mode === 'normal') await page.screenshot({ path: `/tmp/speech-mobile-${width}-${theme}.png` });
    // Taps inside keep the sheet; a tap outside dismisses it, as does the close control.
    await preview.tap(); assert(await sheet.isVisible());
    if (count % 2) await close.tap();
    else await page.locator('.stage-footer').tap({ position: { x: 4, y: 4 } });
    await sheet.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.speech-box').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    count++;
  }
  console.log(`PASS ${count} phone speech scenarios: 390/320px, light/dark, page/fullscreen; full line at 16px inside the viewport, 44px dismiss target, no focus ring on tap, tap-inside keeps, tap-outside and close dismiss.`);
} finally { await browser.close(); }
