// Local route fixtures only; never connects to or mutates a live world.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let snapshot;
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
  await page.routeWebSocket('**/socket?**', () => {});
  await page.goto(base);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { beginConversation, advanceConversations } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'group-browser', name: 'Nearby conversations', populationCap: 4 }, Date.now(), 42);
    world.characters.forEach((c, i) => Object.assign(c, { x: 30 + i * 3, floor: 0, destination: 0, trait: 'curious', energy: 70, mood: 60, name: ['Alexandra', 'Benjamin', 'Christopher', 'Dorothea'][i] }));
    const entry = beginConversation(world, world.characters[0], world.characters[1], true);
    world.minute += 6; advanceConversations(world);
    return { world, presence: [], serverNow: Date.now() };
  });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}/w/group-browser`);
    const thread = page.locator('.journal-entry .conversation-thread').first();
    await thread.waitFor();
    assert.match(await thread.innerText(), /4 residents/);
    for (const c of snapshot.world.characters) assert((await thread.locator('summary').innerText()).includes(c.name));
    await thread.locator('..').locator('.journal-open-conversation').click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /4 residents/);
    await page.keyboard.press('Escape');
    await page.locator('.speech-box .expandable-text').click();
    const link = page.getByRole('button', { name: /^Open conversation among/ });
    for (const c of snapshot.world.characters) assert((await link.innerText()).includes(c.name));
    await link.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.match(await dialog.innerText(), /4 residents/);
    assert.equal(await dialog.locator('.conversation-thread li').count(), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert(await dialog.evaluate(e => e.scrollWidth <= e.clientWidth + 1));
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
  }
  await page.screenshot({ path: '/tmp/group-conversations-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: four named participants in journal, speech link and modal; keyboard navigation; 1440/390/320px; no overflow or page errors');
} finally { await browser.close(); }
