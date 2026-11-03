import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = []; const commands = []; const sockets = [];
let snapshot; let rejectNext = false;
await context.route('**/api/**', async route => {
  if (route.request().method() === 'POST') {
    const command = route.request().postDataJSON(); commands.push(command);
    await new Promise(resolve => setTimeout(resolve, 150));
    if (rejectNext) { rejectNext = false; return route.fulfill({ status: 400, json: { error: 'Please choose a different name.' } }); }
    snapshot.world = await page.evaluate(async ({ world, command }) => {
      const { applyCommand } = await import('/src/simulation/engine.ts');
      applyCommand(world, command, world.lastTickAt); return world;
    }, { world: snapshot.world, command });
    for (const socket of sockets) socket.send(JSON.stringify({ type: 'snapshot', ...snapshot }));
  }
  return route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot });
});
await context.routeWebSocket('**/socket?**', socket => {
  sockets.push(socket);
  socket.onMessage(message => { if (message === 'ping') socket.send('pong'); });
  socket.onClose(() => sockets.splice(sockets.indexOf(socket), 1));
});
context.on('page', p => p.on('pageerror', e => errors.push(e.message)));
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    return { world: createWorld({ slug: 'rename-browser', name: 'Names' }, Date.now(), 42), presence: [], serverNow: Date.now() };
  });
  const before = structuredClone(snapshot.world);
  await page.goto(`${origin}/w/rename-browser`);
  const observer = await context.newPage();
  await observer.goto(`${origin}/w/rename-browser`);
  const open = async p => {
    await p.getByRole('button', { name: 'Residents', exact: true }).click();
    await p.locator('.resident-row').first().click();
  };
  await open(page); await open(observer);
  const panel = page.locator('.world-sidebar');
  const edit = scope => scope.getByRole('button', { name: /^Edit .+’s name$/ });
  const input = scope => scope.getByRole('textbox', { name: 'Resident name', exact: true });
  const save = scope => scope.getByRole('button', { name: 'Save name', exact: true });
  await edit(panel).focus(); await page.keyboard.press('Enter');
  assert.equal(await input(panel).evaluate(el => el === document.activeElement), true);
  await input(panel).fill('Cancelled'); await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(commands.length, 0);
  assert.equal(await edit(panel).evaluate(el => el === document.activeElement), true);
  await edit(panel).click(); await input(panel).fill('   '); await save(panel).click();
  await panel.getByRole('alert').filter({ hasText: 'between 1 and 30' }).waitFor();
  assert.equal(commands.length, 0); assert.equal(await input(panel).getAttribute('maxlength'), '30');
  await input(panel).fill('  Ellis  ');
  await input(panel).evaluate(el => { el.form.requestSubmit(); el.form.requestSubmit(); });
  await panel.getByRole('heading', { name: 'Ellis', exact: true }).waitFor();
  await observer.locator('.world-sidebar').getByRole('heading', { name: 'Ellis', exact: true }).waitFor();
  assert.deepEqual(commands, [{ type: 'rename-character', characterId: before.characters[0].id, name: 'Ellis' }]);
  assert.equal(await edit(panel).evaluate(el => el === document.activeElement), true);
  await edit(panel).click(); await save(panel).click(); assert.equal(commands.length, 1);
  await panel.getByRole('button', { name: /in a larger panel/ }).click();
  const modal = page.locator('.resident-modal');
  await edit(modal).click(); await input(modal).fill('Cancelled again'); await page.keyboard.press('Escape');
  assert.equal(await modal.isVisible(), true); assert.equal(commands.length, 1);
  await edit(modal).click(); rejectNext = true; await input(modal).fill('Nora'); await save(modal).click();
  await modal.getByRole('alert').filter({ hasText: 'Please choose a different name.' }).waitFor();
  assert.equal(await input(modal).inputValue(), 'Nora');
  await save(modal).click(); await modal.getByRole('heading', { name: 'Nora', exact: true }).waitFor();
  await observer.locator('.world-sidebar').getByRole('heading', { name: 'Nora', exact: true }).waitFor();
  assert.equal(commands.length, 3);
  const expected = structuredClone(before); expected.characters[0].name = 'Nora';
  assert.deepEqual(snapshot.world, expected);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await edit(modal).click();
      await input(modal).fill('A'.repeat(30));
      assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await modal.locator('.resident-name-editor').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      if (process.env.SCREENSHOT_DIR) await modal.screenshot({ path: `${process.env.SCREENSHOT_DIR}/rename-${width}-${theme}.png` });
      await input(modal).press('Escape');
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload(); await open(page);
  await panel.getByRole('heading', { name: 'Nora', exact: true }).waitFor();
  await panel.getByRole('button', { name: 'All residents', exact: true }).click();
  assert.match(await panel.locator('.resident-row').first().innerText(), /Nora/);
  assert.deepEqual(errors, []);
  console.log('PASS: keyboard focus, Cancel/Escape, blank validation, trimming, duplicate submission prevention, server error/retry, repeated/no-op edits, two-viewer live labels, reload, unchanged identity/history, desktop/mobile light/dark layouts.');
} finally { await browser.close(); }
