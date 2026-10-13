// Run with the local app running and Playwright available.
// Optional: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROMIUM_PATH=/path/to/chromium
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:5173';
 await page.goto(base);await page.locator('.world-card').first().waitFor();
 const href=await page.locator('.world-card').first().getAttribute('href');await page.goto(base+href);
 const toggle=page.locator('.journal-panel-toggle'),panel=page.locator('#world-journal-panel');await toggle.waitFor();
 for(const width of [320,375,768,900,980,1280,1440]){
  await page.setViewportSize({width,height:900});
  await page.getByRole('button',{name:'Milestones',exact:true}).click();
  const before=await page.locator('.world-stage').boundingBox();
  for(let i=0;i<3;i++){
   await toggle.focus();await page.keyboard.press(i%2?'Space':'Enter');
   assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.equal(await panel.isVisible(),false);
   assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
   const after=await page.locator('.world-stage').boundingBox();
   assert(width<=900?Math.abs(after.width-before.width)<1:after.width>before.width+200);
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#world-journal-panel')),false);
   await toggle.focus();await page.keyboard.press('Space');assert.equal(await panel.isVisible(),true);
   assert.equal(await page.getByRole('button',{name:'Milestones',exact:true}).getAttribute('class'),'selected');
  }
  await page.getByRole('button',{name:'Everything',exact:true}).click();
  const scroll=page.locator('.journal-scroll');await scroll.evaluate(el=>el.scrollTop=150);
  const position=await scroll.evaluate(el=>el.scrollTop);
  await toggle.click();await toggle.click();assert.equal(await scroll.evaluate(el=>el.scrollTop),position);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log(`PASS ${width}px: 3 keyboard cycles, focus, hidden descendants, width, filters, scroll, no horizontal clipping`);
 }
 await page.getByRole('button',{name:'Bonds',exact:true}).click();await toggle.click();await toggle.click();assert.equal(await page.getByRole('button',{name:'Bonds',exact:true}).getAttribute('class'),'active');
 await toggle.click();await page.reload();await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await page.goto(base);await page.goto(base+href);await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await page.locator('.resident-sprite').first().focus();await page.keyboard.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.locator('.character-detail').waitFor();
 const name=await page.locator('.character-heading h2').textContent();await toggle.click();await toggle.click();assert.equal(await page.locator('.character-heading h2').textContent(),name);
 console.log('PASS tab/profile retention, reload/navigation persistence, resident keyboard auto-reopen');
 await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.locator('.world-fullscreen').waitFor();
 await toggle.click();assert.equal(await panel.isVisible(),false);await toggle.click();assert.equal(await panel.isVisible(),true);
 await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
 console.log('PASS fullscreen collapse/expand');
 await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='kinarium-journal-collapsed')throw new DOMException('Blocked','SecurityError');return get.call(this,k)};Storage.prototype.setItem=function(k,v){if(k==='kinarium-journal-collapsed')throw new DOMException('Blocked','SecurityError');return set.call(this,k,v)}});
 await page.reload();await toggle.waitFor();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');await toggle.click();
 console.log('PASS unavailable journal storage fallback');assert.deepEqual(errors,[]);console.log('PASS no browser exceptions');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
