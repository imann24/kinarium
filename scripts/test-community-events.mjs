// Run against a local Vite server; no live worlds are touched.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, hasTouch: true });
  await page.route('**/api/worlds', r => r.fulfill({ json: { worlds: [] } }));
  await page.goto(base);
  const snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    return { world: createWorld({ slug: 'events', name: 'Events' }, 0, 42), presence: [], protected: false, serverNow: Date.now() };
  });
  const sent = [];
  await page.route('**/api/worlds/events', r => r.fulfill({ json: snapshot }));
  await page.route('**/api/worlds/events/commands', r => {
    sent.push(r.request().postDataJSON()); return r.fulfill({ json: snapshot });
  });
  await page.routeWebSocket('**/api/worlds/**/socket*', () => {});
  await page.goto(`${base}/w/events`);
  for (const [name, id] of [['A community gathering', 'community-gathering'], ['A vulnerable share out', 'vulnerable-share'], ['A group meditation', 'group-meditation']]) {
    const button = page.locator(`#house-events [data-event-id="${id}"]`);
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/commands')), button.tap()]);
    assert.deepEqual(sent.at(-1), { type: 'trigger-event', eventId: id });
  }
  const catalogSize = await page.evaluate(async () => (await import('/src/simulation/catalog.ts')).EVENTS.length);
  assert.equal(await page.locator('.event-option').count(), catalogSize);
  assert(await page.locator('#house-events [data-event-id="shared-meal"]').isVisible());
  console.log('PASS: all three community events send the correct command on touch; the full event catalog remains available');
} finally { await browser.close(); }
