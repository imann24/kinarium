// Local synthetic world only; intercept every API request and socket.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
let snapshot;
await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/worlds') ? { worlds: [] } : snapshot }));
await page.routeWebSocket('**/socket?**', () => {});
const shots = process.env.SCREENSHOT_DIR;
if (shots) await mkdir(shots, { recursive: true });
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async () => {
    const { createWorld } = await import('/src/simulation/engine.ts');
    const { refreshResidentSummaries } = await import('/src/simulation/resident-summary.ts');
    const world = createWorld({ slug: 'modal-browser', name: 'Resident profile fixture' }, Date.now(), 42);
    world.minute = 1200;
    world.history = [];
    world.characters[1].name = 'Cleo';
    world.characters[2].name = 'Fern';
    world.characters[3].name = 'Otis';
    const c = world.characters[0];
    Object.assign(c, { name: 'Milo', trait: 'kind', mood: 0, energy: 83, belonging: 79, activity: 'talking with Fern', backstory: 'Milo believes most problems can be solved by making something with your hands.' });
    c.memories = [
      { eventId: 1, minute: 1100, kind: 'friendship', participantIds: [world.characters[1].id], text: 'I became friends with a neighbor.', tone: 'warm', salience: 5 },
      { eventId: 2, minute: 1000, kind: 'conflict', participantIds: [world.characters[2].id], text: 'I was here for a shouting match.', tone: 'tense', salience: 4 },
      { eventId: 3, minute: 900, kind: 'conversation', participantIds: [world.characters[3].id], text: 'We talked about an attempt to repair.', tone: 'warm', salience: 4 },
      { eventId: 4, minute: 800, kind: 'ritual', participantIds: [world.characters[1].id], text: 'We shared evening tea.', tone: 'warm', salience: 3 },
    ];
    world.characters[1].away = true;
    world.characters[1].memories = [];
    refreshResidentSummaries(world, 1000);
    c.memories.push({ text: 'A new memory waiting.', minute: 1200 });
    return { world, presence: [], serverNow: Date.now() };
  });
  await page.goto(`${origin}/w/modal-browser`);
  await page.getByRole('button', { name: 'Meet Milo', exact: true }).click();
  const modal = page.locator('.resident-modal');
  await modal.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await modal.getByRole('meter', { name: 'Mood', exact: true }).getAttribute('aria-valuenow'), '0');
  assert.equal(await modal.locator('.resident-influences').getAttribute('open'), null);
  assert.match(await modal.innerText(), /Story so far/);
  assert.doesNotMatch(await modal.innerText(), /Changed summaries refresh/);
  const influences = modal.locator('.resident-influences > summary');
  await influences.focus(); await page.keyboard.press('Enter');
  assert.match(await modal.innerText(), /Energy does not directly change mood/);
  await page.keyboard.press('Enter');
  const freshness = modal.locator('.history-freshness > summary');
  await freshness.focus(); await page.keyboard.press('Space');
  assert.match(await modal.innerText(), /Original records are preserved/);
  await page.keyboard.press('Space');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    for (const width of [1440, 900, 390, 320]) {
      await page.setViewportSize({ width, height: width > 900 ? 1000 : 900 });
      await modal.getByRole('heading', { name: 'Milo', exact: true }).click();
      await modal.evaluate(el => el.scrollTop = 0);
      assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth), true, `${theme} ${width}: modal overflow`);
      assert.equal(await modal.locator('.resident-overview').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await modal.locator('.resident-history').evaluate(el => el.scrollWidth <= el.clientWidth), true);
      assert.equal(await modal.getByRole('heading', { name: 'Milo', exact: true }).isVisible(), true);
      if (shots) {
        await page.screenshot({ path: `${shots}/${theme}-${width}.png` });
        if (width <= 390) {
          await modal.locator('.resident-history').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/${theme}-${width}-story.png` });
          await modal.locator('.resident-controls').scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/${theme}-${width}-settings.png` });
        }
      }
    }
  }
  await modal.getByRole('button', { name: 'Edit Milo’s name' }).click();
  await modal.getByRole('textbox', { name: 'Resident name', exact: true }).fill('A'.repeat(30));
  assert.equal(await modal.locator('.resident-name-editor').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  await page.keyboard.press('Escape');
  assert.equal(await modal.isVisible(), true);
  const retained = modal.locator('.history-retained > summary');
  await retained.click();
  await modal.locator('.history-retained .history-source summary').first().click();
  assert.match(await modal.innerText(), /I became friends with a neighbor/);
  await modal.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Residents', exact: true }).click();
  await page.getByRole('button', { name: 'All residents', exact: true }).click();
  await page.getByRole('button', { name: 'Away · 1', exact: true }).click();
  await page.locator('.resident-row').first().click();
  await page.getByRole('button', { name: /in a larger panel/ }).click();
  assert.match(await modal.innerText(), /Paused while away/);
  assert.match(await modal.innerText(), /Their lived history will grow/);
  assert.equal(await modal.getByRole('button', { name: 'Welcome back to the house', exact: true }).isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: resident modal meters, keyboard disclosures, original memories, name editing, away/empty states, light/dark at 1440/900/390/320px, no overflow or page errors.');
} finally { await browser.close(); }
