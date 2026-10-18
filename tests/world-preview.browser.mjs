import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const shots = process.env.SCREENSHOT_DIR;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1280,height:1400}});
let worlds = []; const errors = [];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**', route => route.fulfill({json:{worlds}}));
try {
  await page.goto(origin);
  worlds = await page.evaluate(async()=>{
    const {applyCommand,createWorld,summarize} = await import('/src/simulation/engine.ts');
    const house = (slug,name,count,templateId) => {
      const w = createWorld({slug,name,templateId,populationCap:40},Date.now(),slug.length*97);
      while (w.characters.filter(c=>!c.away).length < count) applyCommand(w,{type:'add-character'},Date.now());
      w.characters.slice(count).forEach(c=>applyCommand(w,{type:'set-away',characterId:c.id,away:true},Date.now()));
      return w;
    };
    const duo = house('duo','Duo',2,'lantern-tower');
    applyCommand(duo,{type:'set-appearance',characterId:duo.characters[0].id,color:'#7981a8',appearance:{skinTone:1,hairStyle:2,hairColor:1}},Date.now());
    const {residents:_, ...legacy} = summarize(house('legacy','Legacy',5,'common-house'),false);
    return [summarize(duo,false),summarize(house('seaside','Seaside',12,'harbor-house'),false),summarize(house('chaos','Chaos',30,'courtyard-house'),false),legacy];
  });
  await page.reload();
  const card = name => page.locator('.world-card').filter({has:page.getByRole('heading',{name,exact:true})});
  await card('Duo').waitFor();
  for (const [name,count] of [['Duo',2],['Seaside',12],['Chaos',30]]) {
    assert.equal(await card(name).locator('.resident-sprite').count(),count,name);
    await card(name).getByRole('img',{name:`${name}, with ${count} residents at home`}).waitFor();
  }
  const duo = card('Duo');
  assert.equal(await duo.locator('.resident-sprite').first().locator('path[fill="#7981a8"]').count(),1);
  assert(await card('Legacy').locator('.resident-sprite').count() > 0);
  if (shots) await page.locator('.world-grid').screenshot({path:`${shots}/world-previews.png`});
  assert.deepEqual(errors,[]);
  console.log('world previews ok');
} finally { await browser.close(); }
