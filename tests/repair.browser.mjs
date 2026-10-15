// Run with the local Vite server; uses real engine fixtures and no live mutations.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
let snapshot;
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
await page.routeWebSocket('**/socket?**', () => {});
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { beginConversation, advanceConversations } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'title-browser', name: 'Conversation titles' }, Date.now(), 42);
    const [a, b] = world.characters;
    a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
    a.floor = b.floor = 0;
    const { relationship } = await import('/src/simulation/engine.ts');
    const { repairScene } = await import('/src/simulation/repair.ts');
    a.energy = b.energy = a.mood = b.mood = 75;
    const r = relationship(world, a.id, b.id); r.trust = 5;
    beginConversation(world, a, b, false);
    for (let turn = 0; turn < 8; turn++) { world.minute += 6; advanceConversations(world); }
    world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0));
    for (let turn = 0; turn < 8; turn++) { world.minute += 6; advanceConversations(world); }
    world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0));
    for (let turn = 0; turn < 8; turn++) { world.minute += 6; advanceConversations(world); }
    return { type: 'snapshot', world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/title-browser`);
  await page.locator('.conversation-thread').first().waitFor();
  const titles = page.locator('.conversation-thread summary span');
  const expected = await titles.allTextContents();
  assert.equal(expected.length, 3);
  assert.equal(new Set(expected).size, 3);
  const firstThread = page.locator('.conversation-thread').first();
  await firstThread.locator('summary').click();
  assert((await firstThread.locator('li').count()) >= 4);
  assert.match(await firstThread.innerText(), /Thank you for waiting/);
  const secondThread = page.locator('.conversation-thread').nth(1);
  await secondThread.locator('summary').click();
  assert.match(await secondThread.innerText(), /A promise alone doesn’t settle this/);
  await secondThread.locator('summary').click();
  await firstThread.locator('summary').click();
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const title of await titles.all()) assert.equal(await title.evaluate(e => e.scrollWidth <= e.clientWidth), true);
    const summary = page.locator('.conversation-thread summary').first();
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.conversation-thread').first().getAttribute('open'), '');
    await page.keyboard.press('Enter');
  }
  await page.screenshot({ path: '/tmp/repair-mobile.png', fullPage: true });
  await page.reload(); await titles.first().waitFor();
  assert.deepEqual(await titles.allTextContents(), expected);
  assert.deepEqual(errors, []);
  console.log('PASS: conflict, repair offer and follow-through, distinct headings, revealed turns, keyboard expansion, reload stability, 1440/390/320px, no page errors');
} finally { await browser.close(); }
