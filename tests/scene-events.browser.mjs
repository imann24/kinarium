// Local fixtures only: no requests or commands reach a live house.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
let snapshot; let socket;
const commands = []; const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => { Math.random = () => 0; });
await page.route('**/api/**', async route => {
  if (route.request().method() === 'POST') {
    const command = route.request().postDataJSON();
    commands.push(command);
    snapshot.world = await page.evaluate(async ({ world, command }) => {
      const { applyCommand } = await import('/src/simulation/engine.ts');
      applyCommand(world, command, Date.now());
      return world;
    }, { world: snapshot.world, command });
  }
  await route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot });
});
await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
const tray = page.getByRole('region', { name: 'Set the next scene' });
const options = tray.locator('[data-event-id]');
const shuffle = tray.getByRole('button', { name: 'Shuffle quick-access events' });
const ids = () => options.evaluateAll(elements => elements.map(element => element.dataset.eventId));
async function push() {
  socket.send(JSON.stringify({ type: 'snapshot', ...snapshot }));
  await page.waitForTimeout(100);
}
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    return { world: createWorld({ slug: 'scene-shuffle', name: 'The common house' }, Date.now(), 42), presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/scene-shuffle`);
  await options.first().waitFor();
  const initial = await ids();
  assert.equal(initial.length, 3);
  snapshot.serverNow += 1000;
  await push();
  assert.deepEqual(await ids(), initial, 'ordinary snapshots must not shuffle');
  await shuffle.focus();
  await page.keyboard.press('Enter');
  const manual = await ids();
  assert(manual.every(id => !initial.includes(id)), 'shuffle should offer three fresh choices');
  assert.equal(commands.length, 0, 'shuffle never sends a house command');
  assert.equal(await shuffle.evaluate(element => element === document.activeElement), true);
  const response = page.waitForResponse(response => response.url().endsWith('/commands'));
  await options.first().click();
  await response;
  await page.waitForFunction(() => document.querySelector('.scene-events [role="status"]').textContent.includes('Settling'));
  assert.deepEqual(commands, [{ type: 'trigger-event', eventId: manual[0] }]);
  assert.notDeepEqual(await ids(), manual, 'a house event automatically refreshes choices');
  assert.equal(await options.evaluateAll(elements => elements.every(element => element.disabled)), true);
  assert.equal(await shuffle.isEnabled(), true);
  const settling = await ids();
  await shuffle.click();
  assert((await ids()).every(id => !settling.includes(id)));
  const afterShuffle = await ids();
  snapshot.serverNow += 1000;
  await push();
  assert.deepEqual(await ids(), afterShuffle, 'countdown ticks keep manual choices');
  await mkdir('.impeccable/review', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const width of [2048, 1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      await tray.scrollIntoViewIfNeeded();
      assert.equal(await tray.evaluate(element => element.scrollWidth <= element.clientWidth), true, `tray overflow: ${theme}/${width}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `page overflow: ${theme}/${width}`);
      for (const control of [shuffle, tray.getByRole('link', { name: 'All events' })]) {
        const box = await control.boundingBox();
        assert(box.height >= 44 && box.width >= 44, `touch target: ${theme}/${width}`);
      }
      if (theme === 'dark' && [1440, 390, 320].includes(width) || theme === 'light' && width === 1440) {
        const name = theme === 'light' ? 'light-desktop' : width === 1440 ? 'desktop' : width === 390 ? 'mobile' : 'small-mobile';
        await tray.screenshot({ path: `.impeccable/review/${name}.png` });
      }
    }
  }
  snapshot.eventIds = ['shared-meal', 'care-package'];
  await push();
  assert.equal(await options.count(), 2);
  const two = await ids();
  await shuffle.click();
  assert.deepEqual(await ids(), [...two].reverse());
  snapshot.eventIds = ['care-package'];
  await push();
  assert.deepEqual(await ids(), ['care-package']);
  assert.equal(await shuffle.isDisabled(), true);
  snapshot.eventIds = [];
  await push();
  assert.equal(await options.count(), 0);
  assert.equal(await shuffle.isDisabled(), true);
  assert.equal(commands.length, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: automatic refresh, stable snapshots/countdowns, keyboard shuffle, fresh choices, real event dispatch, shuffle during cooldown, server catalog changes, 44px targets, light/dark at 2048/1440/1024/768/390/320px, no page errors');
} finally { await browser.close(); }
