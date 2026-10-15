// Local browser regression for the actual Building and reusable text component.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 for (const theme of ['light','dark']) for (const width of [390,1440]) for (const key of ['click','Enter','Space']) {
  await page.setViewportSize({width,height:900});
  await page.goto(base);
  await page.evaluate(async ({theme})=>{
   const {default:React}=await import('/node_modules/.vite/deps/react.js');
   const {default:{createRoot}}=await import('/node_modules/.vite/deps/react-dom_client.js');
   const {default:Building}=await import('/src/client/Building.tsx');
   const {createWorld}=await import('/src/simulation/engine.ts');
   const world=createWorld({slug:'expansion-test',name:'Expansion test'},1000,42);
   world.characters=world.characters.slice(0,1);
   Object.assign(world.characters[0],{speech:'We don’t have to make this change before everyone has had a chance to share their thoughts. '+ 'LongUnbrokenText'.repeat(12),floor:0,x:100});
   document.documentElement.dataset.theme=theme;
   const host=document.createElement('div');document.body.replaceChildren(host);
   window.selections=0;
   createRoot(host).render(React.createElement(Building,{world,onSelect:()=>window.selections++}));
  },{theme});
  const bubble=page.locator('.speech-box .expandable-text');
  await bubble.waitFor();
  assert.equal(await bubble.getAttribute('aria-expanded'),'false');
  if(key==='click') await bubble.click(); else {await bubble.focus();await page.keyboard.press(key);}
  assert.equal(await bubble.getAttribute('aria-expanded'),'true');
  assert((await bubble.innerText()).endsWith('LongUnbrokenText'.repeat(12)));
  await bubble.click();
  assert.equal(await bubble.getAttribute('aria-expanded'),'true');
  assert.equal(await page.evaluate(()=>window.selections),0);
  assert(await bubble.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1&&el.scrollHeight<=el.clientHeight+1;}),'Complete text fits with no clipping or horizontal overflow');
  await page.locator('.resident-sprite').focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.selections),1);
 }
 assert.deepEqual(errors,[]);
 console.log('Passed 12 expansion scenarios: light/dark, mobile/desktop, click/Enter/Space, full text, no collapse, independent resident selection.');
} finally {await browser.close();}
