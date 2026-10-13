// Run against the local dev app with Playwright installed (no production writes).
// PLAYWRIGHT_MODULE / CHROMIUM_PATH select an existing browser installation.
// BASELINE=1 disables only this fix to measure the previous fullscreen behavior.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local test server');
const baseline = !!process.env.BASELINE;
const output = process.env.SCREENSHOT_DIR || '/tmp/kinarium-fullscreen';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const results = [];
try {
 for (const fallback of [false, true]) {
  const page = await browser.newPage({colorScheme: fallback ? 'dark' : 'light'});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (fallback) await page.addInitScript(() => { Element.prototype.requestFullscreen = async () => { throw new Error('Fullscreen unavailable'); }; });
  if (baseline) await page.route(/\/src\/client\/useFullscreenCanvas\.ts(?:\?.*)?$/, route => route.fulfill({ contentType: 'application/javascript', body: 'export function useFullscreenCanvas() {}' }));
  for (const templateId of ['common-house', 'makers-house', 'harbor-house']) {
   const slug = `canvas-check-${templateId}`;
   const existing = await page.request.get(`${base}/api/worlds/${slug}`);
   if (existing.status() === 404) {
    const created = await page.request.post(`${base}/api/worlds`, { data: { slug, name: `Canvas check ${templateId}`, templateId, mode: 'persistent', populationCap: 12 } });
    assert(created.ok(), await created.text());
   }
   for (const [width, height] of [[1440,900], [1280,800], [1920,1080], [1280,1200], [768,1024], [390,844], [844,390]]) {
    await page.setViewportSize({width,height});
    await page.goto(`${base}/w/${slug}`, {waitUntil:'domcontentloaded'});
    const toggle = page.locator('.journal-panel-toggle');
    await toggle.waitFor();
    if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
    const measure = () => page.locator('.world-stage .building').evaluate(svg => {
     const m = svg.getScreenCTM(), b = svg.getBoundingClientRect(), v = svg.viewBox.baseVal;
     const footer = document.querySelector('.stage-footer').getBoundingClientRect();
     return {scale:m.a, scaleY:m.d, width:b.width, height:b.height, x:m.e+v.x*m.a, y:m.f+v.y*m.d, right:m.e+(v.x+v.width)*m.a, bottom:m.f+(v.y+v.height)*m.d, footerBottom:footer.bottom};
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(100);
    const checkNormal = async () => {
     const scene = await measure();
     const geometry = await page.locator('.world-stage').evaluate(stage => ({
      bottom: stage.getBoundingClientRect().bottom,
      canvasTop: stage.querySelector('.building').getBoundingClientRect().top,
      controls: stage.querySelector('.stage-footer').offsetHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
     }));
     assert(!geometry.overflow, 'No horizontal overflow');
     if (width > 900) {
      assert(geometry.canvasTop < 285, 'Compact desktop header leaves room for the world');
      if (height <= 1080) assert(scene.height >= height-460, 'Actual default canvas uses reclaimed header space');
     }
     assert(await page.locator('.journal-panel-toggle').evaluate(el => {
      const r=el.getBoundingClientRect();
      return r.height>=44 && r.left>=0 && r.right<=innerWidth && el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
     }), 'Journal action stays accessible and unobscured');
     assert(scene.scale > 0 && Math.abs(scene.scale-scene.scaleY)<.0001, 'Normal scene aspect ratio');
     if (geometry.canvasTop + geometry.controls + 177 <= height) assert(geometry.bottom <= height-15, 'Normal scene and controls fit');
     const scrollScale = scene.scale;
     await page.evaluate(() => window.scrollTo(0,100)); await page.waitForTimeout(50);
     assert(Math.abs((await measure()).scale-scrollScale)<.002, 'Scrolling must not resize the scene');
     await page.evaluate(() => window.scrollTo(0,0));
    };
    if (!baseline) {
     await checkNormal();
     await toggle.click(); await page.waitForTimeout(100); await checkNormal();
     await toggle.click(); await page.waitForTimeout(100);
     await page.setViewportSize({width:width-40,height:height+40}); await page.waitForTimeout(100);
     await page.setViewportSize({width,height}); await page.waitForTimeout(100); await checkNormal();
     if (width===1440 || width===390) await page.screenshot({path:`${output}/normal-${templateId}-${width}-${fallback?'dark':'light'}.png`});
    }
    const normal = await measure();
    assert(await page.locator('.world-stage .building').evaluate(svg => {
     const frame=svg.getBoundingClientRect();
     return [...svg.querySelectorAll('.building-shell, [data-resident-id], [data-elevator-cabin], :scope > text:last-child')].every(el=>{
      const b=el.getBoundingClientRect();
      return b.left>=frame.left-1 && b.right<=frame.right+1 && b.top>=frame.top-1 && b.bottom<=frame.bottom+1;
     });
    }), 'Live scene framing retains the house, residents, elevator and caption');
    assert.equal(await page.locator('.world-stage .community-stats').count(),0);
    assert.equal(await page.getByRole('region',{name:'Community summary'}).count(),1);
    await page.getByRole('button', {name:'Enter fullscreen',exact:true}).click();
    await page.locator('.world-fullscreen').waitFor();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), !fallback);
    const shown = await measure();
    await toggle.click(); await page.waitForTimeout(100);
    const hidden = await measure();
    assert.equal(await page.locator('#world-journal-panel').isVisible(), false);
    if (!baseline) {
     assert(hidden.scale >= shown.scale - .002, 'Collapsing must not shrink the scene');
     // Once height-limited, reclaiming journal width cannot safely enlarge the scene.
     if (width > 900 && Math.abs(shown.right-shown.x-shown.width)<2) {
      assert(hidden.scale > shown.scale*1.05, 'Hiding journal enlarges width-limited artwork');
     }
     assert(Math.abs(hidden.scale - hidden.scaleY) < .0001, 'Preserve aspect ratio');
     assert(hidden.x >= 0 && hidden.right <= width + 1, 'Full world width visible');
     if (height > 500) assert(hidden.y >= 0 && hidden.bottom <= height && hidden.footerBottom <= height, 'World and action controls fit');
    }
    if (!fallback) await page.screenshot({path:`${output}/${baseline?'before':'after'}-${templateId}-${width}x${height}-hidden.png`});
    await page.setViewportSize({width:width-40,height:height+40}); await page.waitForTimeout(100);
    const resized = await measure(); assert(Math.abs(resized.scale-resized.scaleY)<.0001);
    await page.setViewportSize({width,height}); await page.waitForTimeout(100);
    assert(Math.abs((await measure()).scale-hidden.scale)<.002, 'Resize restores scale');
    await toggle.click(); await page.waitForTimeout(100);
    if (!baseline) assert(Math.abs((await measure()).scale-shown.scale)<.002, 'Showing journal restores scale');
    if (!fallback && width===1440) await page.screenshot({path:`${output}/${baseline?'before':'after'}-${templateId}-shown.png`});
    await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.world-fullscreen').count(),0);
    assert(Math.abs((await measure()).scale-normal.scale)<.002,'Exit restores normal layout');
    assert.equal(await page.locator('.world-layout').evaluate(el=>el.style.getPropertyValue('--fullscreen-canvas-height')), '');
    results.push({templateId,mode:fallback?'fallback':'native',width,height,shown:shown.scale,hidden:hidden.scale,growth:`${((hidden.scale/shown.scale-1)*100).toFixed(1)}%`});
   }
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();
  await page.locator('.journal-panel-toggle').click();
  await page.locator('.resident-sprite').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.journal-panel-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('.character-detail').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.world-fullscreen').count(),0);
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.table(results);
 await writeFile(`${output}/${baseline?'before':'after'}-measurements.json`,JSON.stringify(results,null,2));
} finally { await browser.close(); }
