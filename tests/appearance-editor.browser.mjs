import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const shots = process.env.SCREENSHOT_DIR;
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:1280,height:1000}});
let snapshot; const commands = []; const errors = [];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**', async route => {
  if (route.request().method() === 'POST') {
    const command = route.request().postDataJSON(); commands.push(command);
    Object.assign(snapshot.world.characters.find(c=>c.id===command.characterId),{color:command.color,appearance:command.appearance});
  }
  return route.fulfill({json:route.request().url().endsWith('/worlds') ? {worlds:[]} : snapshot});
});
await page.routeWebSocket('**/socket?**',()=>{});
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async()=>{
    const {createWorld} = await import('/src/simulation/engine.ts');
    return {world:createWorld({slug:'looks-browser',name:'Looks'},Date.now(),42),presence:[],serverNow:Date.now()};
  });
  const open = async () => {
    await page.getByRole('button',{name:'Residents',exact:true}).click();
    await page.locator('.resident-row').first().click();
    await page.getByRole('button',{name:/in a larger panel/}).click();
  };
  await page.goto(`${origin}/w/looks-browser`); await open();
  const modal = page.locator('.resident-modal');
  assert.equal(await page.locator('.world-sidebar .appearance-editor').count(),0);
  await modal.getByRole('group',{name:'Hair style'}).getByRole('button',{name:'Tufted'}).click();
  await modal.getByRole('group',{name:'Hair style'}).getByRole('button',{name:'Tufted',pressed:true}).waitFor();
  await modal.getByRole('group',{name:'Clothing'}).getByRole('button',{name:'Periwinkle'}).click();
  await modal.getByRole('group',{name:'Clothing'}).getByRole('button',{name:'Periwinkle',pressed:true}).waitFor();
  assert.deepEqual(commands.map(c=>c.type),['set-appearance','set-appearance']);
  assert.deepEqual(commands.at(-1).appearance,{skinTone:1,hairStyle:2,hairColor:0});
  assert.equal(commands.at(-1).color,'#7981a8');
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    if (shots) await modal.locator('.appearance-editor').screenshot({path:`${shots}/appearance-${theme}.png`});
  }
  await page.setViewportSize({width:390,height:900});
  assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.reload(); await open();
  await modal.getByRole('group',{name:'Hair style'}).getByRole('button',{name:'Tufted',pressed:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: edits clothing and hair from the expanded resident modal, sends set-appearance, keeps the look after reload, fits a phone width.');
} finally { await browser.close(); }
