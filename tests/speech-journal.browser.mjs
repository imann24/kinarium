// Deterministic local fixtures: exercise the real app without mutating a live world.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let snapshot; let archive = []; let socket; let archiveError = false; const archiveRequests = [];
  await page.route('**/api/**', route => {
    const url = route.request().url();
    if (url.includes('/history?')) {
      archiveRequests.push(url);
      return route.fulfill({ status: archiveError ? 503 : 200, json: archiveError ? { error: 'Offline' } : { entries: archive, nextCursor: null } });
    }
    return route.fulfill({ json: url.endsWith('/worlds') ? { worlds: [] } : snapshot });
  });
  await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
  await page.goto(base);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { beginConversation } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'speech-journal', name: 'Speech journal', populationCap: 2 }, Date.now(), 42);
    const [a,b] = world.characters;
    a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
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
    const link = page.getByRole('button', { name: 'Open conversation', exact: true });
    await link.focus(); await page.keyboard.press(count % 2 ? 'Space' : 'Enter');
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('.sidebar-tabs button').filter({ hasText: 'Bonds' }).getAttribute('class'), 'active');
    assert.equal(await dialog.locator('li').count(), 1);
    assert.equal(await dialog.locator('li p').innerText(), snapshot.world.characters[0].speech);
    assert.equal(await dialog.locator('.conversation-speaker b').innerText(), 'Cleo');
    assert(await dialog.evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1; }));
    if (width === 390 && mode === 'normal') await page.screenshot({ path: `/tmp/conversation-modal-${theme}.png` });
    const close = dialog.getByRole('button', { name: 'Close conversation' });
    assert(await close.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Shift+Tab');
    assert(await dialog.getByRole('button', { name: 'View in journal' }).evaluate(el => el === document.activeElement));
    await page.keyboard.press('Tab');
    assert(await close.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert(await link.evaluate(el => el === document.activeElement));
    await page.keyboard.press('Enter');
    await dialog.getByRole('button', { name: 'View in journal' }).click();
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
    await page.getByRole('dialog').getByRole('button', { name: 'View in journal' }).click();
    await page.waitForFunction(id => document.activeElement?.closest(`[data-conversation-id="${id}"]`), id);
    if (mode !== 'normal') await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    count++;
  }
  for (const reference of [undefined, snapshot.world.history[0].id]) {
    snapshot.world.characters[0].speechConversationId = reference;
    snapshot.world.characters[0].speech = 'Hi!';
    await page.goto(`${base}/w/speech-journal`);
    await page.locator('.speech-box .expandable-text').click();
    assert.equal(await page.locator('.speech-speaker').innerText(), 'Cleo');
    assert.equal(await page.getByRole('button', { name: 'Open conversation', exact: true }).count(), 0);
    assert.equal(await page.locator('.speech-unlinked').innerText(), 'No linked conversation');
  }
  // Archive lookup must ignore a newer duplicate and any earlier fallback records.
  snapshot.world.characters[0].speechConversationId = id;
  archive = snapshot.world.history.filter(e => e.id === id);
  snapshot.world.history = snapshot.world.history.filter(e => e.id !== id);
  await page.goto(`${base}/w/speech-journal`);
  await page.locator('.speech-box .expandable-text').click();
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.locator('.conversation-thread').waitFor();
  assert.equal(await modal.locator('li p').innerText(), archive[0].conversation.turns[0].text);
  await modal.getByRole('button', { name: 'View in journal' }).click();
  await page.waitForFunction(id => document.activeElement?.closest(`[data-conversation-id="${id}"]`), id);
  // Missing ID with unrelated archive results has an explicit empty state.
  snapshot.world.characters[0].speechConversationId = 999999;
  await page.goto(`${base}/w/speech-journal`);
  await page.locator('.speech-box .expandable-text').click();
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  await modal.getByText('This conversation is no longer available in the journal.').waitFor();
  assert.equal(await modal.locator('.conversation-thread').count(), 0);
  await modal.getByRole('button', { name: 'Close conversation' }).click();
  // Live updates retain the selected ID as the speaking resident changes/disappears.
  snapshot.world.characters[0].speechConversationId = id;
  snapshot.world.history.push(archive[0]);
  await page.goto(`${base}/w/speech-journal`);
  await page.locator('.speech-box .expandable-text').click();
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  const changed = structuredClone(snapshot);
  const thread = changed.world.history.find(e => e.id === id).conversation;
  thread.status = 'active';
  thread.turns.push({ speakerId: changed.world.characters[1].id, text: 'A live reply in this exact conversation.', minute: changed.world.minute + 6 });
  delete changed.world.characters[0].speech;
  socket.send(JSON.stringify({ type: 'snapshot', ...changed }));
  await modal.getByText('A live reply in this exact conversation.', { exact: true }).waitFor();
  assert.equal(await modal.locator('li').count(), 2);
  await modal.getByRole('button', { name: 'Close conversation' }).click();
  assert(await page.getByRole('button', { name: 'Open conversation', exact: true }).evaluate(el => el === document.activeElement));
  // Direct archive navigation must not skip intervening journal pages.
  snapshot.world.characters[0].speech = 'Hi!';
  snapshot.world.history = [{ ...archive[0], id: 100 }];
  archiveError = true;
  await page.goto(`${base}/w/speech-journal`);
  await page.locator('.speech-box .expandable-text').click();
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  await modal.getByRole('button', { name: 'Try again' }).waitFor();
  archiveError = false;
  await modal.getByRole('button', { name: 'Try again' }).click();
  await modal.locator('.conversation-thread').waitFor();
  await modal.getByRole('button', { name: 'View in journal' }).click();
  await page.getByRole('button', { name: 'Earlier in the story' }).click();
  await page.waitForTimeout(100);
  assert.equal(new URL(archiveRequests.at(-1)).searchParams.get('before'), '100');
  // Profile links within the full thread retain ordinary resident navigation.
  await page.getByRole('button', { name: 'Open conversation', exact: true }).click();
  await modal.getByRole('button', { name: "View Cleo's profile" }).click();
  await page.locator('.character-detail').waitFor();
  assert.equal(await page.locator('.character-heading h2').innerText(), 'Cleo');
  assert.deepEqual(errors, []);
  console.log(`PASS ${count} modal scenarios: themes, mobile/desktop, native/fallback fullscreen, duplicate-text ID, focus trap/return, Escape, close, journal navigation, no collapse, resident selection; plus unlinked, archived, missing and live-update cases.`);
} finally { await browser.close(); }
