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
  const openSidebar = async () => {
    await page.getByRole('button',{name:'Residents',exact:true}).click();
    await page.locator('.resident-row').first().click();
  };
  const name = snapshot.world.characters[0].name;
  await page.goto(`${origin}/w/looks-browser`); await openSidebar();
  const sidebar = page.locator('.world-sidebar');
  const editButton = sidebar.getByRole('button',{name:`Edit ${name}’s appearance`});
  // The appearance button sits on the same row as the name button.
  const [nameBox, lookBox] = await Promise.all([sidebar.getByRole('button',{name:`Edit ${name}’s name`}).boundingBox(), editButton.boundingBox()]);
  assert(Math.abs(nameBox.y - lookBox.y) < 2 && lookBox.x > nameBox.x);
  await editButton.click();
  const dialog = page.getByRole('dialog',{name:`${name}’s look`});
  await dialog.waitFor();
  await dialog.getByRole('group',{name:'Hair style'}).getByRole('button',{name:'Curly'}).click();
  await dialog.getByRole('group',{name:'Hair color'}).getByRole('button',{name:'Auburn'}).click();
  await dialog.getByRole('group',{name:'Clothing'}).getByRole('button',{name:'Navy'}).click();
  assert.equal(commands.length,0,'picking options only previews until saved');
  for (const theme of ['light','dark']) {
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    if (shots) await dialog.screenshot({path:`${shots}/appearance-modal-${theme}.png`});
  }
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await dialog.getByRole('button',{name:'Save look'}).click();
  await dialog.waitFor({state:'detached'});
  assert.deepEqual(commands.map(c=>c.type),['set-appearance']);
  assert.deepEqual(commands[0].appearance,{skinTone:1,hairStyle:6,hairColor:3});
  assert.equal(commands[0].color,'#4f6f8f');
  // Cancel discards a draft without sending anything.
  await editButton.click(); await dialog.waitFor();
  await dialog.getByRole('group',{name:'Skin'}).getByRole('button',{name:'Deep'}).click();
  await dialog.getByRole('button',{name:'Cancel'}).click(); await dialog.waitFor({state:'detached'});
  assert.equal(commands.length,1);
  // The same button opens the focused modal from the larger resident panel.
  await page.getByRole('button',{name:/in a larger panel/}).click();
  const wide = page.locator('.resident-modal');
  if (shots) await wide.locator('.character-heading').evaluate(el=>el.scrollIntoView());
  if (shots) await page.screenshot({path:`${shots}/appearance-buttons.png`,clip:await wide.locator('.resident-edit-actions').evaluate(el=>{const r=el.parentElement.parentElement.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:Math.min(r.height,170)};})});
  await wide.getByRole('button',{name:`Edit ${name}’s appearance`}).click();
  await dialog.waitFor();
  await dialog.getByRole('group',{name:'Hair style'}).getByRole('button',{name:'Curly',pressed:true}).waitFor();
  await page.keyboard.press('Escape'); await dialog.waitFor({state:'detached'});
  await wide.waitFor();
  await page.setViewportSize({width:390,height:900});
  await wide.getByRole('button',{name:`Edit ${name}’s appearance`}).click(); await dialog.waitFor();
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  if (shots) await dialog.screenshot({path:`${shots}/appearance-modal-phone.png`});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1280,height:1000});
  await page.reload(); await openSidebar();
  await editButton.click(); await dialog.waitFor();
  await dialog.getByRole('group',{name:'Hair color'}).getByRole('button',{name:'Auburn',pressed:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: Edit appearance sits beside Edit name, opens a focused modal from the sidebar and larger panel, previews until saved, cancel discards, look survives reload, fits a phone width.');
} finally { await browser.close(); }
