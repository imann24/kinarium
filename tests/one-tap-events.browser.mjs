// Deterministic local snapshots; no live-world writes.
import assert from 'node:assert/strict';
const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });

async function fixture(options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [], commands = [];
  page.on('pageerror', error => errors.push(error.message));
  let snapshot, socket, respond;
  await page.route('**/api/**', async route => {
    if (route.request().url().endsWith('/commands')) {
      commands.push(route.request().postDataJSON());
      if (respond) return respond(route);
    }
    return route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot });
  });
  await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
  await page.goto(base);
  const data = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { EVENTS } = await import('/src/simulation/catalog.ts');
    return {
      snapshot: { world: createWorld({ slug: 'one-tap', name: 'One tap', populationCap: 2 }, Date.now(), 7), presence: [], serverNow: Date.now() },
      catalog: EVENTS,
    };
  });
  snapshot = data.snapshot;
  await page.goto(`${base}/w/one-tap`);
  await page.waitForFunction(() => document.querySelector('.event-option:not(:disabled)'));
  return {
    page, context, errors, commands, catalog: data.catalog,
    get snapshot() { return snapshot; },
    respond(handler) { respond = handler; },
    publish(update) {
      snapshot = { ...snapshot, ...update, serverNow: Date.now() };
      socket.send(JSON.stringify({ type: 'snapshot', ...snapshot }));
    },
    disconnect() { socket.close({ code: 1000 }); },
  };
}

try {
  for (const theme of ['light', 'dark']) for (const width of [320, 390]) {
    const f = await fixture({ ...devices['iPhone 13'], viewport: { width, height: 844 } });
    const { page } = f;
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme);
    const menu = page.locator('#house-events');
    const event = menu.locator('[data-event-id="shared-meal"]');
    await event.scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => matchMedia('(hover:hover) and (pointer:fine)').matches), false);
    assert.equal(await event.evaluate(el => getComputedStyle(el).touchAction), 'manipulation');
    const overflow = await menu.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return { scroll: el.scrollWidth - el.clientWidth, left: rect.left, right: rect.right, viewport: innerWidth };
    });
    assert(overflow.scroll <= 1 && overflow.left >= 0 && overflow.right <= overflow.viewport + 1, `${theme} ${width}px: event menu stays inside viewport`);
    await Promise.all([page.waitForResponse(response => response.url().endsWith('/commands')), event.tap()]);
    await page.waitForFunction(() => document.querySelector('.event-dispatch-feedback')?.textContent.includes('sent.'));
    assert.deepEqual(f.commands, [{ type: 'trigger-event', eventId: 'shared-meal' }], `${theme} ${width}px: one tap sends exactly once`);
    assert.equal(await event.evaluate(el => getComputedStyle(el).transform), 'none');
    assert.deepEqual(f.errors, []);
    await f.context.close();
  }

  const f = await fixture({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const { page } = f;
  const menu = page.locator('#house-events');
  const events = menu.locator('.event-option');
  const search = menu.getByRole('searchbox', { name: 'Search events' });
  const filters = menu.getByRole('group', { name: 'Show events by tone' });
  assert.equal(await events.count(), f.catalog.length);
  assert.equal(await events.first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', 'reduced motion disables menu transitions');
  await filters.getByRole('button', { name: /^Disruptive/ }).click();
  assert.equal(await events.count(), f.catalog.filter(event => event.tone === 'disruptive').length);
  assert.equal(await filters.getByRole('button', { name: /^Disruptive/ }).getAttribute('aria-pressed'), 'true');
  await search.fill('tension');
  assert.equal(await events.count(), f.catalog.filter(event => event.tone === 'disruptive' && event.tension).length);
  await search.fill('no-such-house-event');
  assert.equal(await events.count(), 0);
  assert(await menu.getByRole('heading', { name: 'No events match this search.' }).isVisible());
  await menu.getByRole('button', { name: 'Show all events' }).click();
  assert.equal(await events.count(), f.catalog.length);
  assert.equal(await search.inputValue(), '');
  await search.fill('energy');
  assert.equal(await events.count(), f.catalog.filter(event => event.energy).length);
  await menu.getByRole('button', { name: 'Clear event search' }).click();
  assert.equal(await search.evaluate(el => el === document.activeElement), true, 'clear search restores input focus');

  // Hold the response: duplicate activation must not dispatch twice or announce success early.
  let release;
  f.respond(route => new Promise(resolve => {
    release = async () => {
      await route.fulfill({ json: { ...f.snapshot, world: { ...f.snapshot.world, cooldowns: { ...f.snapshot.world.cooldowns, events: Date.now() + 45_000 } }, serverNow: Date.now() } });
      resolve();
    };
  }));
  const meal = menu.locator('[data-event-id="shared-meal"]');
  await meal.evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => document.querySelector('.event-send')?.textContent.includes('Sending'));
  assert.equal(f.commands.length, 1, 'rapid activation dispatches once');
  assert.equal(await menu.locator('.event-dispatch-feedback').textContent(), '');
  assert.equal(await menu.locator('.event-option:not(:disabled)').count(), 0, 'all dispatch actions lock while request is pending');
  await release();
  await page.waitForFunction(() => document.querySelector('.event-dispatch-feedback')?.textContent.includes('sent.'));
  assert.match(await meal.locator('.event-send').textContent(), /Sent/);

  f.publish({ world: { ...f.snapshot.world, cooldowns: { ...f.snapshot.world.cooldowns, events: Date.now() + 45_000 } } });
  await page.waitForFunction(() => document.querySelector('.event-dispatch-status')?.textContent.includes('Let the house settle'));
  assert.equal(await menu.locator('.event-option:not(:disabled)').count(), 0);
  await filters.getByRole('button', { name: /^Gentle/ }).click();
  await search.fill('energy');
  assert(await events.count() > 0, 'browsing stays available during cooldown');
  assert.equal(f.commands.length, 1);
  await menu.getByRole('button', { name: 'Clear event search' }).click();
  await filters.getByRole('button', { name: /^All events/ }).click();

  f.publish({ world: { ...f.snapshot.world, cooldowns: { ...f.snapshot.world.cooldowns, events: 0 } } });
  await page.waitForFunction(() => document.querySelector('.event-option:not(:disabled)'));
  assert.equal((await meal.locator('.event-send').textContent()).trim(), 'Send', 'ready event returns to an action label after cooldown');

  f.publish({ playerEvents: { limit: 3, windowMs: 300_000, refillsAt: [Date.now() + 100_000, Date.now() + 200_000, Date.now() + 250_000] } });
  await page.waitForFunction(() => document.querySelector('.event-dispatch-status')?.textContent.includes('allowance is recharging'));
  assert.equal(await menu.locator('.event-option:not(:disabled)').count(), 0);
  assert.equal(await menu.getByRole('meter').getAttribute('aria-valuenow'), '0');

  f.publish({ playerEvents: { limit: 3, windowMs: 300_000, refillsAt: [] } });
  await page.waitForFunction(() => document.querySelector('.event-option:not(:disabled)'));
  f.respond(route => route.fulfill({ status: 503, json: { error: 'Test dispatch failure' } }));
  await meal.focus();
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/commands')), page.keyboard.press('Enter')]);
  await page.waitForFunction(() => document.querySelector('.event-dispatch-feedback')?.textContent.includes('couldn’t be sent'));
  assert.match(await meal.locator('.event-send').textContent(), /Retry/);
  assert(await meal.locator('.event-option-error').isVisible(), 'failure remains visible on the event that was sent');
  assert.equal(f.commands.length, 2, 'keyboard activation dispatches exactly once');
  assert(await meal.isEnabled(), 'failure permits retry');
  f.respond(undefined);
  await Promise.all([page.waitForResponse(response => response.url().endsWith('/commands')), meal.click()]);
  await page.waitForFunction(() => document.querySelector('.event-dispatch-feedback')?.textContent.includes('sent.'));
  assert.equal(f.commands.length, 3);

  f.publish({ eventIds: ['shared-meal', 'quiet-day'] });
  await page.waitForFunction(() => document.querySelectorAll('.event-option').length === 2);
  assert.deepEqual(await events.evaluateAll(elements => elements.map(el => el.dataset.eventId)), ['shared-meal', 'quiet-day']);
  f.publish({ eventIds: [] });
  await menu.getByRole('heading', { name: 'No events are available in this house yet.' }).waitFor();
  assert.equal(await events.count(), 0);
  f.publish({ eventIds: ['shared-meal'] });
  await meal.waitFor();
  f.disconnect();
  await page.waitForFunction(() => document.querySelector('.event-dispatch-status')?.textContent.includes('Reconnecting'));
  assert(await meal.isDisabled(), 'disconnect prevents dispatch');
  assert.deepEqual(f.errors, []);
  await f.context.close();
  console.log('house events: one-tap dispatch passes at 320/390px in light and dark; desktop search, filters, keyboard, pending guard, acknowledgement, retry, cooldown, allowance, server subsets, empty state, and disconnect pass');
} finally { await browser.close(); }
