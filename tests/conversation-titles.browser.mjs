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
    const { beginConversation, interruptConversations } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'title-browser', name: 'Conversation titles' }, Date.now(), 42);
    const [a, b] = world.characters;
    a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
    for (const text of ['I miss sketching boats by the harbor.', 'Drawing helps me find a little quiet.']) {
      const entry = beginConversation(world, a, b, true);
      entry.conversation.turns.push({ speakerId: b.id, text, minute: world.minute, generated: true });
      interruptConversations(world, a.id);
    }
    const legacy = beginConversation(world, a, b, false);
    interruptConversations(world, a.id);
    delete legacy.conversation.title;
    return { type: 'snapshot', world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/title-browser`);
  await page.locator('.conversation-thread').first().waitFor();
  const titles = page.locator('.conversation-thread summary span');
  const expected = await titles.allTextContents();
  assert.equal(expected.length, 3);
  assert(expected.includes('“I miss sketching boats by the harbor”'));
  assert(expected.includes('“Drawing helps me find a little quiet”'));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const title of await titles.all()) assert.equal(await title.evaluate(e => e.scrollWidth <= e.clientWidth), true);
    const summary = page.locator('.conversation-thread summary').first();
    await summary.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.conversation-thread').first().getAttribute('open'), '');
    await page.keyboard.press('Enter');
  }
  await page.screenshot({ path: '/tmp/conversation-titles-mobile.png', fullPage: true });
  await page.reload(); await titles.first().waitFor();
  assert.deepEqual(await titles.allTextContents(), expected);
  assert.deepEqual(errors, []);
  console.log('PASS: distinct grounded titles, legacy topic fallback, keyboard expansion, reload stability, 1440/390/320px, no page errors');
} finally { await browser.close(); }
