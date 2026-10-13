// Run with the local Worker/Vite app and an existing Playwright installation.
// PLAYWRIGHT_MODULE, CHROMIUM_PATH, BASE_URL and SCREENSHOT_DIR are optional.
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname), 'Use a local test server');
const output=process.env.SCREENSHOT_DIR || '/tmp/kinarium-insights';
await mkdir(output,{recursive:true});
await page.goto(base+'/w/the-common-house',{waitUntil:'domcontentloaded'});
await page.locator('.world-stage').waitFor();
assert.equal(await page.locator('.community-insights').count(),0);
const nav = page.getByRole('link',{name:'Community insights',exact:true});
await nav.focus();await page.keyboard.press('Enter');
await page.locator('.community-insights').waitFor();
assert.equal(await page.locator('.world-stage').count(),0);
assert.match(page.url(),/\/w\/the-common-house\/insights/);
await page.getByLabel('Current statistics for').selectOption('all');
await page.getByLabel('Explore connections').selectOption('unmet');
await page.getByLabel('Explore connections').selectOption('all');
const pair=page.locator('.insights-bond').first();await pair.focus();await page.keyboard.press('Enter');
await page.locator('.insights-pair').waitFor();
const savedUrl=page.url();assert.match(savedUrl,/scope=all/);assert.match(savedUrl,/pair=/);
const profile=page.locator('.insights-profile-links button').first();await profile.focus();await page.keyboard.press('Enter');
await page.locator('dialog[open]').waitFor();
assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);
let commands=0;
page.on('request',r=>{if(r.url().endsWith('/commands'))commands++;});
const away=page.getByRole('button',{name:'Let them take some time away'});
await away.click();await page.locator('.away-confirmation[open]').waitFor();
await page.getByRole('button',{name:'Cancel',exact:true}).click();
assert.equal(commands,0);assert.equal(await away.evaluate(e=>e===document.activeElement),true);
await away.click();await page.keyboard.press('Escape');
assert.equal(commands,0);assert.equal(await page.locator('dialog[open]').count(),1);
await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
assert.equal(page.url(),savedUrl);
assert.equal(await page.evaluate(()=>document.activeElement.className),'outline');
await page.getByRole('link',{name:'Back to the world',exact:true}).click();
await page.locator('.world-stage').waitFor();
await page.goBack();await page.locator('.insights-pair').waitFor();
assert.equal(await page.getByLabel('Current statistics for').inputValue(),'all');
assert.equal(page.url(),savedUrl);
await page.goForward();await page.locator('.world-stage').waitFor();
await page.goto(savedUrl,{waitUntil:'domcontentloaded'});await page.locator('.insights-pair').waitFor();
await page.getByText('View activity as a table',{exact:true}).click();assert.equal(await page.locator('table').isVisible(),true);
await page.getByText('View activity as a table',{exact:true}).click();
for(const theme of ['light','dark']){
 await page.getByLabel('Color theme').selectOption(theme);
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${theme} ${width} overflow`);
  await page.screenshot({path:`${output}/${theme}-${width}.png`,fullPage:true});
 }
}
await page.reload();await page.locator('.community-insights').waitFor();
assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
assert.deepEqual(errors,[]);
console.log('PASS: native keyboard links, separate route, filters/pair URL restore, profile modal/Escape/focus return, back/forward, table alternative, light/dark at 1440/768/390/320px, persistent theme, no page errors');
await browser.close();
