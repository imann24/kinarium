import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:8787';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Integration tests create fixtures. Use a local development server.');
const suffix = Date.now().toString(36);
const sockets = [];
async function request(path, data, cookie, expected = 200, headers = {}) {
  const r = await fetch(`${origin}/api${path}`, { method: data === undefined ? 'GET' : 'POST', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) });
  const value = await r.json(); assert.equal(r.status, expected, JSON.stringify(value));
  return { value, cookie: r.headers.get('set-cookie')?.split(';')[0] };
}
async function connect(slug, name, cookie) {
  const ws = new WebSocket(`${origin.replace('http', 'ws')}/api/worlds/${slug}/socket?name=${name}&player=${name}`, { headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) } });
  sockets.push(ws); ws.snapshots = [];
  ws.on('message', bytes => { if (bytes.toString() !== 'pong') ws.snapshots.push(JSON.parse(bytes)); });
  await new Promise((resolve,reject) => { ws.once('open',resolve); ws.once('error',reject); }); return ws;
}
async function until(fn, message, ms = 8_000) { const end = Date.now()+ms; while (Date.now()<end) { if (fn()) return; await delay(100); } assert.fail(message); }
const command = (slug, data, cookie, status) => request(`/worlds/${slug}/commands`,data,cookie,status);
try {
  const { value: list } = await request('/worlds'); assert.ok(list.worlds.some(w=>w.slug==='the-common-house'));
  const { value: templates } = await request('/templates');
  for (const templateId of templates.map(t => t.id)) {
    const template = templates.find(t => t.id === templateId); assert.ok(template, `${templateId} should be discoverable`);
    const fixture = `test-${templateId}-${suffix}`;
    const { value: created } = await request('/worlds', { name: template.name, slug: fixture, templateId, populationCap: 7 }, undefined, 201);
    assert.equal(created.templateId, templateId);
    const { value: snapshot } = await request(`/worlds/${fixture}`);
    assert.equal(snapshot.world.version, 1); assert.equal(snapshot.world.templateId, templateId);
    const identities = world => world.characters.map(({ id, name, trait, backstory }) => ({ id, name, trait, backstory }));
    assert.equal(snapshot.world.characters.length, 6);
    assert.equal(new Set(snapshot.world.characters.map(c => c.name)).size, 6);
    for (const c of snapshot.world.characters) assert.ok(template.starterResidents.some(p => p.name === c.name && p.trait === c.trait && p.backstory === c.backstory));
    const { value: reloaded } = await request(`/worlds/${fixture}`);
    assert.deepEqual(identities(reloaded.world), identities(snapshot.world));
    await command(fixture, { type: 'add-character' });
    const { value: restored } = await request(`/worlds/${fixture}`);
    assert.equal(restored.world.templateId, templateId); assert.equal(restored.world.characters[6].id, 'c7');
    assert.deepEqual(identities(restored.world).slice(0, 6), identities(snapshot.world));
    assert.equal(new Set(restored.world.characters.map(c => c.name)).size, 7);
  }
  await request('/worlds', { name: 'Unknown template', slug: `test-invalid-${suffix}`, templateId: 'missing' }, undefined, 400);
  console.log('PASS: template discovery, creation, persisted selection, template residents, and invalid-template rejection');
  const slug = `test-live-${suffix}`;
  await request('/worlds',{name:'Integration house',slug,populationCap:7},undefined,201);
  await request('/worlds',{name:'Duplicate',slug},undefined,409);
  const a = await connect(slug,'Alice'); const b = await connect(slug,'Bob');
  await until(()=>a.snapshots.at(-1)?.presence.length===2 && b.snapshots.at(-1)?.presence.length===2,'Both players should see one another');
  const initialMinute = a.snapshots.at(-1).world.minute;
  const original = a.snapshots.at(-1).world;
  const details = {type:'house-details',name:'Renamed integration house',description:'Updated description',expectedRevision:0};
  await command(slug,details);
  await command(slug,details); // Safe repeat after a lost response.
  await command(slug,{...details,name:'Stale edit'},undefined,409);
  for (const invalid of [{name:'   '},{name:'x'.repeat(61)},{description:'x'.repeat(241)},{expectedRevision:-1},{description:null}])
    await command(slug,{...details,...invalid},undefined,400);
  await until(()=>a.snapshots.at(-1)?.world.name===details.name && b.snapshots.at(-1)?.world.description===details.description,'House details should broadcast to both sessions');
  const renamed = (await request(`/worlds/${slug}`)).value.world;
  assert.equal(renamed.slug,slug); assert.equal(renamed.createdAt,original.createdAt); assert.equal(renamed.detailsRevision,1);
  assert.deepEqual(renamed.settings,original.settings);
  assert.ok(original.history.every(entry=>renamed.history.some(saved=>saved.id===entry.id && saved.text===entry.text)));
  const directory = (await request('/worlds')).value.worlds.find(w=>w.slug===slug);
  assert.equal(directory.name,details.name); assert.equal(directory.description,details.description);
  console.log('PASS: house details persistence, directory, two-session broadcast, stable identity/history, validation, stale and repeated submissions');

  const results = await Promise.all([1,2,3].map(i => fetch(`${origin}/api/worlds/${slug}/commands`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'add-character',name:`Neighbor ${i}`})})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400,400]);
  await until(()=>a.snapshots.at(-1)?.world.characters.length===7 && b.snapshots.at(-1)?.world.characters.length===7,'Both visitors should receive the same new resident');
  await command(slug,{type:'set-away',characterId:'c1',away:true});
  await command(slug,{type:'add-character',name:'Someone new'});
  await command(slug,{type:'set-away',characterId:'c1',away:false},undefined,400);
  await command(slug,{type:'settings',mode:'persistent',populationCap:8});
  await command(slug,{type:'set-away',characterId:'c1',away:false});
  await command(slug,{type:'trigger-event',eventId:'shared-meal'});
  await command(slug,{type:'trigger-event',eventId:'rumor'},undefined,400);
  await request(`/worlds/${slug}/commands`,{type:'trigger-event',eventId:'shared-meal'},undefined,403,{Origin:'https://untrusted.example'});
  await until(()=>a.snapshots.at(-1)?.world.minute>initialMinute,'Occupied world should tick through alarms',10_000);
  console.log('PASS: multiplayer presence, shared state, concurrent cap enforcement, away/return, settings, event cooldown, origin protection, live alarms');
  b.close(); await until(()=>a.snapshots.at(-1)?.presence.length===1,'Presence should remove a disconnected visitor');
  await command(slug,{type:'settings',mode:'fast-forward',populationCap:8});
  a.close(); await delay(250);
  const quietBefore = (await request(`/worlds/${slug}`)).value.world;
  await delay(4_500);
  const quietAfter = (await request(`/worlds/${slug}`)).value.world;
  assert.ok(quietAfter.minute>quietBefore.minute); assert.equal(quietAfter.characters.length,8);
  console.log('PASS: fast-forward catches up a vacant world without losing residents');
  const locked = `test-locked-${suffix}`;
  await request('/worlds',{name:'Private integration house',slug:locked,password:'a secret password',mode:'persistent'},undefined,201);
  for(const tail of ['','/history','/socket']) await request(`/worlds/${locked}${tail}`,undefined,undefined,401);
  await command(locked,{type:'add-character'},undefined,401);
  await command(locked,{type:'house-details',name:'Unauthorized',description:'',expectedRevision:0},undefined,401);
  await request(`/worlds/${locked}/unlock`,{password:'incorrect'},undefined,401);
  const { cookie } = await request(`/worlds/${locked}/unlock`,{password:'a secret password'}); assert.ok(cookie);
  const { value: privateState } = await request(`/worlds/${locked}`,undefined,cookie); assert.equal(privateState.protected,true);
  await command(locked,{type:'house-details',name:'Authorized private house',description:'',expectedRevision:0},cookie);
  await command(locked,{type:'house-details',name:'Unauthorized',description:'',expectedRevision:1},undefined,401);
  const c = await connect(locked,'Carol',cookie); await until(()=>c.snapshots.length>0,'Authorized websocket should open'); c.close();
  const before = (await request(`/worlds/${locked}/history`,undefined,cookie)).value.entries;
  const oldest = before.at(-1).id; const page = (await request(`/worlds/${locked}/history?before=${oldest}`,undefined,cookie)).value; assert.equal(page.entries.length,0);
  console.log('PASS: password verification, protected snapshots/history/actions/sockets, authorized connection, history cursor');
  console.log('Checking unoccupied persistent mode; waiting for its one-minute alarm…');
  await delay(65_000);
  const after = (await request(`/worlds/${locked}/history`,undefined,cookie)).value.entries;
  assert.ok(after.some(e=>e.minute>privateState.world.minute),'History should advance without a visitor or snapshot read');
  console.log('PASS: persistent mode evolves with no connected visitors');
  // Leave fixtures in economical fast-forward mode.
  await command(locked,{type:'settings',mode:'fast-forward',populationCap:12},cookie);
  console.log(`ALL INTEGRATION CHECKS PASSED. Restart persistence fixture: ${slug}`);
} finally { for(const ws of sockets) ws.close(); }
