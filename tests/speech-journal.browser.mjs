// Deterministic local fixtures: exercise the real app without mutating a live world.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let snapshot;
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
  await page.routeWebSocket('**/socket?**', () => {});
  await page.goto(base);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { beginConversation } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'speech-journal', name: 'Speech journal', populationCap: 2 }, Date.now(), 42);
    const [a,b] = world.characters;
    a.name = 'Cleo'; a.floor = b.floor = a.destination = b.destination = 0;
    const entry = beginConversation(world, a, b, true);
    a.speech = 'We should talk about this together. ' + 'LongUnbrokenText'.repeat(20);
    entry.conversation.turns[0].text = a.speech;
    entry.conversation.status = 'finished'; // Clicking must open even a closed thread.
    // Identical text in a newer conversation must not steal the link.
    const duplicate = structuredClone(entry); duplicate.id = world.nextLog++;
    world.history.push(duplicate);
    return { world, presence: [], serverNow: Date.now() };
  });
  const id = snapshot.world.characters[0].speechConversationId;
  let count = 0;
  for (const theme of ['light', 'dark']) for (const width of [320, 390, 1440]) for (const mode of ['normal', 'native', 'fallback']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/w/speech-journal`);
    await page.locator('.speech-box').waitFor();
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    if (mode === 'fallback') await page.evaluate(() => { Element.prototype.requestFullscreen = async () => { throw new Error('Unavailable'); }; });
    if (mode !== 'normal') {
      await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).click();
      await page.locator('.world-fullscreen').waitFor();
    }
    const toggle = page.locator('.journal-panel-toggle');
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    await page.getByRole('button', { name: 'Milestones', exact: true }).click();
    await page.getByRole('button', { name: 'Bonds', exact: true }).click();
    await toggle.click();
    const text = page.locator('.speech-box .expandable-text');
    await text.focus(); await page.keyboard.press(count % 2 ? 'Enter' : 'Space');
    assert.equal(await text.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.speech-speaker').innerText(), 'Cleo');
    assert.equal(await text.innerText(), snapshot.world.characters[0].speech);
    await text.click();
    assert.equal(await text.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.character-detail').count(), 0);
    assert(await page.locator('.speech-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    const link = page.getByRole('button', { name: 'Open conversation in journal' });
    await link.focus(); await page.keyboard.press(count % 2 ? 'Space' : 'Enter');
    const summary = page.locator(`[data-conversation-id="${id}"] summary`);
    await page.waitForFunction(id => document.activeElement?.closest(`[data-conversation-id="${id}"]`), id);
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert(await summary.locator('..').evaluate(el => el.open));
    assert.equal(await page.getByRole('button', { name: 'Everything', exact: true }).getAttribute('class'), 'selected');
    assert(await summary.evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // Reopening the same ID works after switching to a resident profile.
    await page.locator('.resident-sprite').first().focus(); await page.keyboard.press('Enter');
    await page.locator('.character-detail').waitFor();
    await link.click();
    await page.waitForFunction(id => document.activeElement?.closest(`[data-conversation-id="${id}"]`), id);
    if (mode !== 'normal') await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    count++;
  }
  for (const reference of [undefined, 999999, snapshot.world.history[0].id]) {
    snapshot.world.characters[0].speechConversationId = reference;
    snapshot.world.characters[0].speech = 'Hi!';
    await page.goto(`${base}/w/speech-journal`);
    await page.locator('.speech-box .expandable-text').click();
    assert.equal(await page.locator('.speech-speaker').innerText(), 'Cleo');
    assert.equal(await page.getByRole('button', { name: 'Open conversation in journal' }).count(), 0);
    assert.equal(await page.locator('.speech-unlinked').innerText(), 'No linked conversation');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${count} linked scenarios (themes, mobile/desktop, native/fallback fullscreen), exact duplicate-text ID, repeated navigation, keyboard, no collapse, resident selection; 3 short/unlinked scenarios.`);
} finally { await browser.close(); }
