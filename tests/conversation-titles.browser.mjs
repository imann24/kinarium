// Run against a local Vite server. No backend, paid inference, or real-world writes.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
if (!['localhost','127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use a local Vite server.');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page = await browser.newPage();
const errors=[]; page.on('pageerror',error=>errors.push(error.message));
let snapshot;
await page.route('**/api/**', route=>route.fulfill({json:route.request().url().endsWith('/worlds')?{worlds:[]}:snapshot}));
await page.routeWebSocket('**/socket?**',()=>{});
try {
  await page.goto(origin);
  snapshot=await page.evaluate(async()=>{
    const {createWorld}=await import('/src/simulation/engine.ts');
    const {beginConversation}=await import('/src/simulation/conversations.ts');
    const {finalizeConversationTitle}=await import('/src/simulation/conversation-titles.ts');
    const world=createWorld({slug:'title-check',name:'Title check'},Date.now(),42);
    for(let index=0;index<2;index++){
      const entry=beginConversation(world,world.characters[0],world.characters[1],true);
      entry.conversation.status='finished';
      entry.conversation.turns=[
        {speakerId:'c1',text:'The blue teapot reminds me of Sunday mornings.',minute:480},
        {speakerId:'c2',text:'Sharing tea makes the kitchen feel less unfamiliar.',minute:486},
      ];
      finalizeConversationTitle(world,entry);
    }
    return {world,presence:[],serverNow:Date.now()};
  });
  await page.goto(`${origin}/w/title-check`);
  const summaries=page.locator('.conversation-thread summary');
  await summaries.first().waitFor();
  const expected=snapshot.world.history.filter(e=>e.conversation).reverse().map(e=>e.conversation.title);
  assert.notEqual(expected[0],expected[1]);
  assert.deepEqual(await summaries.locator('span').allTextContents(),expected);
  await summaries.first().click();
  assert.equal(await page.locator('.conversation-thread').first().getAttribute('open'),'');
  await page.getByRole('button',{name:'Residents',exact:true}).click();
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  assert.deepEqual(await summaries.locator('span').allTextContents(),expected);
  await page.reload(); await summaries.first().waitFor();
  assert.deepEqual(await summaries.locator('span').allTextContents(),expected);
  await page.setViewportSize({width:390,height:844});
  assert.deepEqual(await summaries.locator('span').allTextContents(),expected);
  assert.deepEqual(errors,[]);
  console.log('PASS: distinct revealed-detail titles, expansion, tab switching, reload stability, narrow viewport, no browser errors');
} finally {await browser.close();}
