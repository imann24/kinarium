// Directory-only fixtures; this test never creates or changes a server world.
// Run against pnpm dev:client, with PLAYWRIGHT_MODULE/CHROMIUM_PATH if needed.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const worlds = [
  { slug: 'the-common-house', name: 'The common house', description: 'A shared kitchen, a rooftop garden, and a few neighbors figuring it out together.', templateId: 'common-house', population: 6, populationCap: 12, protected: false, mode: 'persistent' },
  { slug: 'the-makers-house', name: 'The makers’ house', description: 'Somewhere to make a mess, share an idea, and see what happens next.', templateId: 'makers-house', population: 5, populationCap: 16, protected: false, mode: 'fast-forward' },
  { slug: 'the-harbor-house', name: 'The harbor house', description: 'A place to return to. Bring a story from the shore.', templateId: 'harbor-house', population: 4, populationCap: 10, protected: true, mode: 'persistent' },
].map(w => ({ ...w, createdAt: 0, cohesion: 60 }));
let response = { worlds };
let status = 200;
await page.route('**/api/worlds', route => route.fulfill({ status, json: response }));
const capture = process.env.LANDING_SCREENSHOTS;
if (capture) await mkdir(capture, { recursive: true });
async function noOverflow() {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page must not overflow horizontally');
}
try {
  await page.goto(origin);
  await page.getByRole('heading', { name: 'The neighborhood' }).waitFor();
  await page.locator('.house-listing').last().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.getByRole('link', { name: 'Visit this house', exact: true }).getAttribute('href'), '/w/the-common-house');
  await page.getByLabel('Preview a house').selectOption('the-harbor-house');
  assert.equal(await page.getByRole('link', { name: 'Enter with a password' }).getAttribute('href'), '/w/the-harbor-house');
  await page.getByLabel('Preview a house').selectOption('the-common-house');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.kinariumTheme.setPreference(theme), theme);
    for (const width of [1440, 1280, 390, 320]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await noOverflow();
      assert(await page.locator('.featured-scene').isVisible(), 'house stays visible on mobile');
      if (capture && [1440, 390].includes(width)) await page.screenshot({ path: `${capture}/${theme === 'dark' ? 'dark-' : ''}${width === 1440 ? 'desktop' : 'mobile'}.png`, fullPage: true });
    }
  }
  await page.getByRole('button', { name: 'Open doors', exact: true }).click();
  assert.equal(await page.locator('.house-listing').count(), 2);
  assert.equal(await page.getByRole('button', { name: 'Open doors', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'Always on', exact: true }).click();
  assert.equal(await page.locator('.house-listing').count(), 2);
  await page.getByRole('button', { name: 'All worlds', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search worlds' }).fill('  makers  ');
  assert.equal(await page.locator('.house-listing').count(), 1);
  assert.equal(await page.locator('.house-listing').getAttribute('href'), '/w/the-makers-house');
  await page.getByRole('searchbox', { name: 'Search worlds' }).fill('no such house');
  await page.getByRole('heading', { name: 'No doors on this path.' }).waitFor();
  await page.getByRole('button', { name: 'Show all worlds' }).click();
  assert.equal(await page.locator('.house-listing').count(), 3);
  await page.getByRole('button', { name: 'Create a world', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByLabel('World name', { exact: true }).fill('A new neighborhood');
  assert.equal(await page.getByLabel('World address').inputValue(), 'a-new-neighborhood');
  await page.getByLabel('World template').selectOption('harbor-house');
  await page.getByLabel('Protect the door with a password').check();
  await page.getByLabel(/^World password/).waitFor();
  if (capture) await page.screenshot({ path: `${capture}/creation-mobile.png`, fullPage: false });
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Field guide', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await page.getByRole('link', { name: 'Find your little corner' }).click();
  assert.equal(new URL(page.url()).hash, '#worlds');
  await page.getByRole('button', { name: 'Open doors', exact: true }).focus();
  await page.keyboard.press('Space');
  assert.equal(await page.getByRole('button', { name: 'Open doors', exact: true }).getAttribute('aria-pressed'), 'true');
  response = { worlds: [{ ...worlds[0], name: 'W'.repeat(60), description: 'A'.repeat(240) }] };
  await page.reload();
  await page.locator('.house-listing').waitFor();
  await noOverflow();
  response = { worlds: [] };
  await page.reload();
  await page.getByRole('heading', { name: 'The neighborhood starts with you.' }).waitFor();
  assert.equal(await page.getByLabel('Preview a house').count(), 0);
  await page.getByText('A common-house template', { exact: true }).waitFor();
  status = 503; response = { error: 'Directory temporarily unavailable.' };
  await page.reload();
  await page.getByRole('alert').filter({ hasText: 'We couldn’t open the directory.' }).waitFor();
  status = 200; response = { worlds };
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.locator('.house-listing').last().waitFor();
  assert.equal(await page.locator('.house-listing').count(), 3);
  assert.deepEqual(errors, []);
  console.log('PASS: directory links, protected featured house, search/filters/reset, creation controls, guide, keyboard, theme persistence, empty/error/retry, long content, light/dark at 1440/1280/390/320px; no page errors.');
} finally {
  await browser.close();
}
