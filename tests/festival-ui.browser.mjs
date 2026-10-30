// Deterministic local fixtures: this check never writes a real house or admin session.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
await page.emulateMedia({ reducedMotion: 'reduce' });
const shots = process.env.SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let snapshot;
await page.route('**/api/**', route => {
  const url = route.request().url();
  if (url.includes('/admin/')) return route.fulfill({ status: 401, json: { error: 'Sign in to manage houses.' } });
  if (url.includes('/locked-house')) return route.fulfill({ status: 401, json: { error: 'Password required.' } });
  return route.fulfill({ json: url.endsWith('/worlds') ? { worlds: [] } : snapshot });
});
await page.routeWebSocket('**/socket?**', () => {});
async function settled() {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function fits() {
  await settled();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `page overflow: ${page.url()}`);
  for (const dialog of await page.locator('dialog[open]').all()) {
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), 'dialog must fit its width');
  }
}
async function capture(name, theme, width) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll("dialog[open]").forEach(el => { el.scrollTop = 0; }); });
  await fits();
  if (shots && [1440, 390].includes(width)) await page.screenshot({ path: `${shots}/${name}-${theme}-${width}.png`, fullPage: !(await page.locator("dialog[open]").count()) });
}
async function contrast(selector, minimum = 4.5) {
  const ratios = await page.locator(selector).evaluateAll(elements => {
    const luminance = color => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    return elements.filter(el => el.getClientRects().length).map(el => {
      const style = getComputedStyle(el);
      let parent = el, background = style.backgroundColor;
      while (background === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor; }
      const fg = luminance(style.color), bg = luminance(background);
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
    });
  });
  assert(ratios.length, `missing contrast target: ${selector}`);
  for (const ratio of ratios) assert(ratio >= minimum, `${selector}: contrast ${ratio.toFixed(2)} < ${minimum}`);
}
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld, relationship } = await import('/src/simulation/engine.ts');
    const world = createWorld({ slug: 'festival-fixture', name: 'The common house', description: 'A shared kitchen, a rooftop garden, and a few neighbors figuring it out together.', populationCap: 12 }, Date.now(), 7);
    Object.assign(relationship(world, 'c1', 'c2'), { encounters: 4, affinity: 50, trust: 72 });
    return { world, presence: [], serverNow: Date.now() };
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.kinariumTheme.setPreference(theme), theme);
    for (const width of [1440, 900, 390, 320]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.goto(`${origin}/w/festival-fixture`);
      await page.locator('.world-stage').waitFor();
      await capture('world', theme, width);
      await contrast('.stage-footer .primary');
      await contrast('.world-view-nav a[aria-current=page]');
      await contrast('.sidebar-tabs .active');
      await contrast('.stage-toolbar');
      assert.match(await page.locator('.world-heading h1').evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
      assert.match(await page.locator('.stage-footer .primary').evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
      await page.getByRole('button', { name: 'World settings', exact: true }).hover();
      await contrast('.world-heading-actions .outline');
      await page.getByRole('button', { name: 'World settings', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await capture('settings', theme, width);
      await contrast('dialog .primary');
      const scrollBefore = await page.evaluate(() => scrollY);
      await page.getByRole('dialog').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await page.getByRole('dialog').hover();
      await page.mouse.wheel(0, 1000);
      await settled();
      assert.equal(await page.evaluate(() => scrollY), scrollBefore, 'dialog must contain background scrolling');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Residents', exact: true }).click();
      await page.locator('.resident-row').first().click();
      await page.getByRole('button', { name: /in a larger panel/ }).click();
      await capture('resident', theme, width);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Hide journal' }).click();
      assert(await page.locator('.world-sidebar').isHidden());
      await page.getByRole('button', { name: 'Show journal' }).click();
      assert(await page.locator('.world-sidebar').isVisible());
      await page.getByRole('button', { name: 'Card deck', exact: true }).click();
      await contrast('.deck-tone, .deck-cta');
      assert(await page.locator('.deck-card').evaluateAll(els => els.every(el => getComputedStyle(el).opacity === '1')), 'enabled cards retain readable opacity');
      if (width < 500) {
        await page.getByRole('link', { name: 'House events', exact: true }).click();
        assert.equal(await page.evaluate(() => location.hash), '#house-events');
      }
      await page.goto(`${origin}/w/festival-fixture/insights`);
      await page.locator('.insights-summary').waitFor();
      await capture('insights', theme, width);
      if (width < 500) {
        assert.equal(await page.locator('.insights-columns').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1, 'phone insight lists stack vertically');
        assert.equal(await page.locator('.insights-summary').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), 1, 'phone summary uses readable rows');
      }
      await page.getByText('How connection labels work', { exact: true }).click();
      assert(await page.locator('.insights-explainer').evaluate(el => el.open));
      await page.getByRole('button', { name: 'Field guide', exact: true }).click();
      await page.locator('.guide-item[open] .guide-item-body').waitFor({ state: 'visible' });
      await capture('guide', theme, width);
      await page.keyboard.press('Escape');
      await page.goto(origin);
      await page.getByRole('button', { name: 'Create a world', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await capture('create', theme, width);
      await page.keyboard.press('Escape');
      await page.goto(`${origin}/admin`);
      await page.locator('.admin-login').waitFor();
      await capture('admin', theme, width);
      await page.goto(`${origin}/w/locked-house`);
      await page.locator('.locked-world').waitFor();
      await capture('locked', theme, width);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/w/festival-fixture`);
  await page.locator('.world-stage').waitFor();
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement);
  await page.getByRole('button', { name: 'World settings', exact: true }).click();
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.querySelector('.world-fullscreen'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden', 'open dialog remains scroll locked after fullscreen exit');
  await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden', 'closing the last dialog restores page scrolling');
  await page.setViewportSize({ width: 320, height: 844 });
  snapshot.world.name = 'A very long house name that needs room to wrap without overlap';
  snapshot.world.description = 'AnUnbrokenHouseDescription'.repeat(8);
  await page.goto(`${origin}/w/festival-fixture`);
  await page.locator('.world-stage').waitFor();
  await fits();
  assert.deepEqual(errors, []);
  console.log('Interface UI passed: house, insights, dialogs, guide, admin, locked house; 320/390/900/1440px, both themes, action contrast, journal toggling, long content.');
} finally { await browser.close(); }
