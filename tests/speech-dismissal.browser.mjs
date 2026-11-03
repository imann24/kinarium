// Local app with deterministic snapshots and browser time; no live-world writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install();
  let snapshot, initial, socket;
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
  await page.routeWebSocket('**/socket?**', ws => { socket = ws; });
  await page.goto(base);
  initial = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { beginConversation } = await import('/src/simulation/conversations.ts');
    const world = createWorld({ slug: 'dismissal', name: 'Reading time', populationCap: 2 }, Date.now(), 42);
    const [a,b] = world.characters;
    a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0; a.name = 'Cleo';
    a.floor = b.floor = a.destination = b.destination = 0;
    const entry = beginConversation(world,a,b,true);
    a.speech = 'This is a longer thought that deserves time to read. ' + 'LongWord'.repeat(50);
    entry.conversation.turns[0].text = a.speech;
    return { world, presence: [], serverNow: Date.now() };
  });
  async function load() {
    snapshot = structuredClone(initial);
    await page.goto(`${base}/w/dismissal`);
    await page.locator('.speech-box').waitFor();
  }
  const text = page.locator('.speech-box .expandable-text');
  const close = page.getByRole('button', { name: "Dismiss Cleo's speech" });
  const progress = page.getByRole('progressbar', { name: 'Time until speech dismisses' });
  const send = () => socket.send(JSON.stringify({ type: 'snapshot', ...snapshot }));
  let count = 0;
  for (const theme of ['light', 'dark']) for (const width of [320, 1440]) for (const mode of ['normal', 'native', 'fallback']) {
    await page.setViewportSize({width, height:900}); await load();
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    if (mode === 'fallback') await page.evaluate(() => { Element.prototype.requestFullscreen = async () => { throw new Error('Unavailable'); }; });
    if (mode !== 'normal') { await page.getByRole('button', { name: 'Enter fullscreen', exact:true }).click(); await page.locator('.world-fullscreen').waitFor(); }
    assert.equal(await close.count(), 0);
    await text.focus(); await page.keyboard.press('Enter');
    assert.equal(await progress.getAttribute('aria-valuemax'), '45');
    assert(Number(await progress.getAttribute('aria-valuenow')) >= 44);
    await page.clock.fastForward(20_000);
    const remaining = Number(await progress.getAttribute('aria-valuenow'));
    assert(remaining >= 24 && remaining <= 25);
    const scale = await progress.locator('span').evaluate(el => parseFloat(el.style.width) / 100);
    assert(scale > .5 && scale < .57);
    // Simulation races ahead, clears speech, and keeps rerendering: reading time survives.
    snapshot.world.minute += 10000;
    delete snapshot.world.characters[0].speech;
    for (let i=0;i<8;i++) { snapshot.world.minute++; send(); }
    await page.clock.fastForward(1000);
    assert.equal(await text.getAttribute('aria-expanded'), 'true');
    assert(await progress.evaluate(el => { const r=el.getBoundingClientRect(), parent=el.parentElement.getBoundingClientRect(); return r.top>=parent.top && r.bottom<=parent.bottom; }));
    if (width === 320 && mode === 'normal') await page.screenshot({ path: `/tmp/speech-dismissal-${theme}.png` });
    await close.focus(); await page.keyboard.press(count % 2 ? 'Space' : 'Enter');
    await page.locator('.speech-box').waitFor({state:'hidden'});
    assert(await page.locator('.resident-sprite').first().evaluate(el=>el===document.activeElement));
    if (mode !== 'normal') await page.getByRole('button', { name: 'Exit fullscreen', exact:true }).click();
    count++;
  }
  // Manual dismissal persists across snapshots; the same words in a NEW turn reappear.
  await load(); await text.click(); await close.click(); send();
  await page.clock.fastForward(1000); assert.equal(await text.count(),0);
  snapshot.world.characters[0].speechUntil += 6; send(); await text.waitFor();
  assert.equal(await text.getAttribute('aria-expanded'),'false');
  await text.click(); await page.clock.fastForward(43_000);
  snapshot.world.characters[0].speechUntil += 6; send();
  await page.waitForFunction(()=>document.querySelector('.speech-box .expandable-text')?.getAttribute('aria-expanded')==='false');
  await text.click(); await page.clock.fastForward(3000);
  assert.equal(await text.getAttribute('aria-expanded'),'true');
  assert(Number(await progress.getAttribute('aria-valuenow')) >= 41, 'Old timeout cannot expire the replacement');
  // No simulation changes at all: the real reading deadline still expires.
  await page.clock.fastForward(42_100); await page.locator('.speech-box').waitFor({state:'hidden'});
  send(); await page.clock.fastForward(1000); assert.equal(await text.count(),0);
  // Expiry must not close the conversation modal or steal its keyboard focus.
  await load(); await text.click(); await page.getByRole('button',{name:'Open conversation',exact:true}).click();
  const modal = page.getByRole('dialog'); const modalClose = modal.getByRole('button',{name:'Close conversation'});
  await page.clock.fastForward(45_100);
  assert.equal(await page.locator('.speech-box').count(),0);
  assert(await modal.isVisible()); assert(await modalClose.evaluate(el=>el===document.activeElement));
  await page.keyboard.press('Escape'); await modal.waitFor({state:'hidden'});
  assert(await page.locator('.journal-panel-toggle').evaluate(el=>el===document.activeElement));
  // Escape dismisses the expanded speech; it never collapses it.
  await load(); await text.focus(); await page.keyboard.press('Space'); await page.keyboard.press('Escape');
  assert.equal(await text.count(),0);
  // A different speaker cannot cover the reading card; its preview is available after dismissal.
  await load(); await text.click();
  delete snapshot.world.characters[0].speech;
  Object.assign(snapshot.world.characters[1], { speech: 'The other resident replies.', speechUntil: 600 }); send();
  await page.waitForFunction(()=>document.querySelectorAll('.speech-box').length===2);
  assert(await page.locator('.speech-box.expanded').isVisible());
  assert.equal(await page.locator('.speech-box:not(.expanded)').isVisible(),false);
  await close.click();
  assert(await page.locator('.speech-box:not(.expanded)').isVisible());
  // Ordinary collapsed speech still follows the simulation's lifetime.
  await load(); delete snapshot.world.characters[0].speech; send();
  await page.locator('.speech-box').waitFor({state:'hidden'});
  assert.deepEqual(errors, []);
  console.log(`PASS ${count} layout/theme/fullscreen dismissal scenarios; 45s real-time progress/expiry, manual suppression, fast/paused simulation, rerenders, replacement and stale timers, modal focus safety, keyboard dismissal, ordinary speech lifetime.`);
} finally { await browser.close(); }
