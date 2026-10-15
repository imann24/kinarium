import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(origin).hostname));
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const page = await browser.newPage();
let snapshot; const commands = []; const errors = [];
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/api/**', async route => {
  if (route.request().method() === 'POST') {
    const command = route.request().postDataJSON(); commands.push(command);
    snapshot.world.characters.find(c=>c.id===command.characterId).model = command.model || undefined;
  }
  return route.fulfill({json:route.request().url().endsWith('/worlds') ? {worlds:[]} : snapshot});
});
await page.routeWebSocket('**/socket?**',()=>{});
try {
  await page.goto(origin);
  snapshot = await page.evaluate(async()=>{
    const {createWorld} = await import('/src/simulation/engine.ts');
    const world = createWorld({slug:'model-browser',name:'Model selection'},Date.now(),42);
    world.characters[0].model = 'removed';
    return {world,presence:[],serverNow:Date.now(),models:{allowed:['model-a','model-b'],defaultModel:'model-a'}};
  });
  await page.goto(`${origin}/w/model-browser`);
  await page.getByRole('button',{name:'Residents',exact:true}).click();
  await page.locator('.resident-row').first().click();
  const select = page.getByRole('combobox',{name:`Dialogue model for ${snapshot.world.characters[0].name}`});
  await select.waitFor();
  assert.match(await page.locator('.model-selection').innerText(),/no longer allowed/);
  await select.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('.model-selection select')?.value==='model-a');
  assert.equal(commands.at(-1).type,'set-model');
  await select.selectOption('model-b');
  await page.waitForFunction(()=>document.querySelector('.model-selection select')?.value==='model-b');
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.setViewportSize({width:390,height:1000});
    assert.equal(await select.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  }
  await page.reload();
  await page.getByRole('button',{name:'Residents',exact:true}).click(); await page.locator('.resident-row').first().click();
  assert.equal(await select.inputValue(),'model-b');
  assert.deepEqual(errors,[]);
  console.log('PASS: labeled native model selector, keyboard selection, command persistence/reload, removed-model explanation and mobile light/dark layout.');
} finally { await browser.close(); }
