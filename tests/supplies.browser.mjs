import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin=process.env.TEST_ORIGIN||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();let snapshot;const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>route.fulfill({json:route.request().url().endsWith('/worlds')?{worlds:[]}:snapshot}));
await page.routeWebSocket('**/socket?**',()=>{});
try {
 await page.goto(origin);
 snapshot=await page.evaluate(async()=>{
  const {createWorld,relationship}=await import('/src/simulation/engine.ts');
  const {beginConversation,advanceConversations}=await import('/src/simulation/conversations.ts');
  const {advanceSupplyWork}=await import('/src/simulation/supplies.ts');
  const world=createWorld({slug:'supply-browser',name:'Visible needs'},Date.now(),42);
  const [c,b,third]=world.characters;c.name='Cleo';b.name='Fern';third.name='Otis';
  for(const p of world.characters){p.floor=p.destination=2;}
  Object.assign(relationship(world,c.id,b.id),{encounters:301,affinity:14,trust:57});
  Object.assign(relationship(world,c.id,third.id),{encounters:200,affinity:90,trust:90});
  beginConversation(world,c,third,false);
  for(let i=0;i<8;i++){world.minute+=6;advanceConversations(world);}
  Object.assign(world,{resources:4,tension:100});Object.assign(c,{energy:60,mood:0,belonging:19,trait:'curious'});
  advanceSupplyWork(world,c);
  return {world,presence:[],serverNow:Date.now()};
 });
 await page.goto(`${origin}/w/supply-browser`);
 const supply=page.getByRole('region',{name:'Supplies and resident needs'});
 await supply.waitFor();
 assert.match(await supply.innerText(),/Shortage → −0.2 mood/);
 assert.match(await supply.innerText(),/Cleo · replenishing supplies/);
 assert.match(await supply.innerText(),/10 energy spent/);
 assert.equal(await supply.getByRole('progressbar').first().getAttribute('aria-valuenow'),'4');
 await page.getByRole('button',{name:'Residents',exact:true}).click();
 await page.locator('.resident-row').filter({hasText:'Cleo'}).click();
 assert.match(await page.locator('.character-detail').innerText(),/Familiar · mixed connection/);
 assert.match(await page.locator('.character-detail').innerText(),/Unresolved disagreement/);
 const causes=page.getByRole('region',{name:'What affects these values'});
 await causes.locator('summary').last().click();
 assert.match(await causes.innerText(),/Supply work/);assert.match(await causes.innerText(),/Energy −10/);
 for(const theme of ['light','dark'])for(const width of [1440,390,320]){
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;},theme);
  await page.setViewportSize({width,height:1100});
  await supply.locator('summary').focus();await page.keyboard.press('Enter');
  assert.match(await supply.innerText(),/180 simulated minutes/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await supply.evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.keyboard.press('Enter');
 }
 await supply.screenshot({path:'/tmp/kinarium-supplies-mobile.png'});
 await page.getByRole('button',{name:'Journal',exact:true}).click();
 const conflict=page.locator('.kind-conflict .conversation-thread').first();await conflict.locator('summary').click();
 assert.match(await conflict.innerText(),/Recorded outcome: disagreement/);
 assert.match(await conflict.innerText(),/disagree/);
 snapshot=await page.evaluate(async snapshot=>{
  const {advanceSupplyWork}=await import('/src/simulation/supplies.ts');
  const world=snapshot.world;world.minute=world.characters[0].supplyTask.completeAt;
  advanceSupplyWork(world,world.characters[0]);return snapshot;
 },snapshot);
 await page.reload();await supply.waitFor();
 assert.match(await supply.innerText(),/12\/100 · Shortage/);
 assert.match(await supply.innerText(),/No supply work in progress/);
 assert.match(await supply.innerText(),/finishes replenishing shared supplies: \+8 supplies/);
 snapshot=await page.evaluate(async snapshot=>{
  const {applyCommand}=await import('/src/simulation/engine.ts');
  applyCommand(snapshot.world,{type:'trigger-event',eventId:'care-package'},Date.now());return snapshot;
 },snapshot);
 await page.reload();await supply.waitFor();
 assert.match(await supply.innerText(),/Available supplies → \+0.015 mood/);
 await page.goto(`${origin}/w/supply-browser/insights`);await supply.waitFor();
 assert.match(await page.locator('.community-insights').innerText(),/Familiar · mixed connection/);
 assert.match(await page.locator('.community-insights').innerText(),/Unresolved disagreement/);
 assert.deepEqual(errors,[]);
 console.log('PASS: shortage visualization, real energy attribution, timed work, completed resupply, continuing shortage, recovery threshold, relationship history, outcome labels, keyboard, light/dark 1440/390/320px, insights, no page errors');
}finally{await browser.close();}
