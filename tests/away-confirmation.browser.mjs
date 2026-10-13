// Run against `pnpm dev:client` with Playwright available (no backend required).
// PLAYWRIGHT_MODULE may point to an external Playwright installation.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.setDefaultTimeout(30_000);
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use a local Vite server.');
let snapshot;
let socket;
let release;
let fail = false;
const commands = [];
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', async route => {
  if (route.request().url().endsWith('/commands')) {
    commands.push(route.request().postDataJSON());
    await new Promise(resolve => { release = resolve; });
    if (fail) return route.fulfill({ status: 500, json: { error: 'Please try again.' } });
    snapshot.world.characters[0].away = commands.at(-1).away;
  }
  await route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot });
});
await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
const dialog = page.getByRole('dialog');
const trigger = page.getByRole('button', { name: 'Let them take some time away' });
const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
const confirm = page.getByRole('button', { name: 'Confirm time away' });
async function opened() {
  await trigger.click();
  await dialog.waitFor();
  assert.equal(await cancel.evaluate(el => el === document.activeElement), true);
  assert.match(await dialog.innerText(), /Ada/);
  assert.match(await dialog.getAttribute('aria-describedby'), /.+/);
}
async function closed() { await dialog.waitFor({ state: 'detached' }); }
async function push() { socket.send(JSON.stringify(snapshot)); await page.waitForTimeout(80); }
try {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const world = createWorld({ slug: 'confirmation-test', name: 'Confirmation test' }, Date.now(), 123);
    world.characters[0].name = 'Ada';
    return { type: 'snapshot', world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/confirmation-test`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Residents', exact: true }).click();
  await page.locator('.resident-row').first().click();
  for (const dismiss of [() => cancel.click(), () => page.keyboard.press('Enter'), () => page.keyboard.press('Escape'), () => page.getByRole('button', { name: 'Close dialog' }).click(), () => page.mouse.click(2, 2)]) {
    await opened();
    assert.equal(commands.length, 0);
    await dismiss();
    await closed();
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  }
  console.log('PASS: cancellation and restored focus');
  await opened();
  await page.keyboard.press('Tab');
  assert.equal(await confirm.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: 'Close dialog' }).evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await confirm.evaluate(el => el === document.activeElement), true);
  await page.keyboard.press('Escape');
  await closed();
  console.log('PASS: keyboard focus loop');
  // Programmatic selection changes model updates while the background is inert.
  await opened();
  await page.locator('.character-detail .back-link').evaluate(el => el.click());
  await closed();
  await page.locator('.resident-row').first().click();
  await opened();
  snapshot.world.characters[0].away = true;
  await push();
  await closed();
  snapshot.world.characters[0].away = false;
  await push();
  await opened();
  const removed = snapshot.world.characters.shift();
  await push();
  await closed();
  snapshot.world.characters.unshift(removed);
  await push();
  assert.equal(commands.length, 0);
  console.log('PASS: selection, departure, and removal invalidate consent');
  // A failed request stays retryable; rapid clicks and Enter send only once.
  fail = true;
  await opened();
  await confirm.focus();
  await confirm.evaluate(el => { el.click(); el.click(); el.click(); });
  await page.waitForFunction(() => document.querySelector('[role="status"]'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(commands.length, 1);
  release();
  await dialog.getByRole('alert').waitFor();
  assert.equal(await confirm.isEnabled(), true);
  fail = false;
  await confirm.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  assert.equal(commands.length, 2);
  assert.deepEqual(commands[1], { type: 'set-away', characterId: removed.id, away: true });
  // Escape during submission dismisses, but does not cancel or duplicate the sent request.
  await page.keyboard.press('Escape');
  await closed();
  assert.equal(await trigger.isDisabled(), true);
  release();
  await page.getByRole('button', { name: 'Welcome back to the house' }).waitFor();
  assert.equal(commands.length, 2);
  // Return remains immediate and deliberately does not open the departure dialog.
  await page.getByRole('button', { name: 'Welcome back to the house' }).click();
  await page.waitForTimeout(100);
  assert.equal(commands.length, 3);
  assert.equal(commands[2].away, false);
  assert.equal(await dialog.count(), 0);
  release();
  await trigger.waitFor();
  await opened();
  await confirm.click();
  await page.waitForTimeout(100);
  assert.equal(commands.length, 4);
  release();
  await closed();
  await page.getByRole('button', { name: 'Welcome back to the house' }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: no command on open/cancel/Escape/close/backdrop; restored focus; Tab/Shift+Tab trap; selection/status/removal invalidation; repeat submission guard; error/retry; keyboard confirm; pending dismissal; immediate return; no browser errors.');
} finally {
  await browser.close();
}
