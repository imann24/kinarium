// Start Vite first; uses an external Playwright installation and local mocked transport.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(); const errors = []; let snapshot;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
  await page.routeWebSocket('**/socket?**', () => {});
  await page.goto(base);
  snapshot = await page.evaluate(async () => {
    const { createWorld, relationship } = await import('/src/simulation/engine.ts');
    const { advanceConversations, beginConversation } = await import('/src/simulation/conversations.ts');
    const { repairScene } = await import('/src/simulation/repair.ts');
    const world = createWorld({ slug: 'journal-stories', name: 'Journal stories', populationCap: 2 }, Date.now(), 42);
    const [a, b] = world.characters; a.name = 'Fern'; b.name = 'Juniper';
    a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0; a.energy = b.energy = a.mood = b.mood = 75;
    const r = relationship(world, a.id, b.id); Object.assign(r, { trust: 5, affinity: -20, encounters: 3 });
    const finish = () => { for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); } };
    beginConversation(world, a, b, false); finish(); world.minute += 120;
    const bids = [];
    for (const wait of [360, 720, 1440]) { bids.push(beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)).id); finish(); world.minute += wait; }
    for (const c of world.characters) { c.speech = undefined; }
    return { world, presence: [], serverNow: Date.now(), bids };
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/w/journal-stories`);
    const head = page.locator(`[data-conversation-id="${snapshot.bids[2]}"]`); await head.waitFor();
    for (const id of snapshot.bids.slice(0, 2)) assert.equal(await page.locator(`[data-conversation-id="${id}"]`).count(), 0);
    assert.match(await head.locator('.journal-arc').innerText(), /^Third attempt about .+: Fern has reached out, and Juniper’s requests for space were honored 3 times\./);
    assert.equal(await head.locator(':scope > p').count(), 0);
    const earlier = head.locator('.journal-arc-earlier');
    assert.equal(await earlier.locator('summary').innerText(), '2 earlier attempts');
    await earlier.locator('summary').click();
    assert.equal(await earlier.locator('li').count(), 2);
    await page.getByRole('button', { name: 'Stories', exact: true }).click();
    const shown = await page.locator('.timeline .journal-entry').count();
    assert.equal(shown, 1, 'Stories shows only the repair story, not the quarrel or arrivals');
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/journal-stories-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: repeated repair attempts fold under the newest with a summary; Stories filter; desktop and mobile');
} finally { await browser.close(); }
