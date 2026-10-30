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
      const fg = luminance(style.color), bg = luminance(style.backgroundColor);
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
      assert.match(await page.locator('.world-heading h1').evaluate(el => getComputedStyle(el).fontFamily), /Dela Gothic One/);
      assert.match(await page.locator('.stage-footer .primary').evaluate(el => getComputedStyle(el).fontFamily), /Manrope/);
      await page.getByRole('button', { name: 'World settings', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await capture('settings', theme, width);
      await contrast('dialog .primary');
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
      await page.goto(`${origin}/w/festival-fixture/insights`);
      await page.locator('.insights-summary').waitFor();
      await capture('insights', theme, width);
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
  snapshot.world.name = 'A very long house name that needs room to wrap without overlap';
  snapshot.world.description = 'AnUnbrokenHouseDescription'.repeat(8);
  await page.goto(`${origin}/w/festival-fixture`);
  await page.locator('.world-stage').waitFor();
  await fits();
  assert.deepEqual(errors, []);
  console.log('Festival UI passed: house, insights, dialogs, guide, admin, locked house; 320/390/900/1440px, both themes, action contrast, journal toggling, long content.');
} finally { await browser.close(); }
