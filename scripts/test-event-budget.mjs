import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';

const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:8787';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw new Error('Use a local server: this test creates a world.');
const slug = `test-budget-${Date.now().toString(36)}`;
const sockets = [];
async function request(path, data, cookie, status = 200) {
  const response = await fetch(`${origin}/api${path}`, { method: data ? 'POST' : 'GET', headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value));
  return { value, cookie: response.headers.get('set-cookie')?.split(';')[0], retry: response.headers.get('retry-after') };
}
const uses = snapshot => snapshot.playerEvents.refillsAt.length;
async function connect(cookie, name) {
  const ws = new WebSocket(`${origin.replace('http', 'ws')}/api/worlds/${slug}/socket?name=${name}&player=${name}`, { headers: { Cookie: cookie, Origin: origin } });
  ws.latest = null; sockets.push(ws);
  ws.on('message',data => { ws.latest = JSON.parse(data.toString()); });
  await new Promise((resolve,reject) => { ws.once('open',resolve); ws.once('error',reject); });
  return ws;
}
async function until(predicate) { for(let i=0;i<50;i++){if(predicate())return;await delay(100);}assert.fail('WebSocket allowance update did not arrive.'); }
try {
  await request('/worlds', { slug, name: 'Event allowance test', mode: 'fast-forward' }, undefined, 201);
  const alice = await request(`/worlds/${slug}`); const bob = await request(`/worlds/${slug}`);
  assert.ok(alice.cookie); assert.notEqual(alice.cookie,bob.cookie);
  assert.equal(uses(alice.value),0);
  const a = await connect(alice.cookie,'Alice'); const secondTab = await connect(alice.cookie,'AliceSecondTab'); const b = await connect(bob.cookie,'Bob');
  let last;
  for (let i=1;i<=3;i++) {
    if(last) { console.log('Waiting for the existing 45-second world cooldown…'); await delay(Math.max(0,last.world.cooldowns.events-Date.now())+100); }
    last = (await request(`/worlds/${slug}/commands`, { type:'trigger-event', eventId:'shared-meal' }, alice.cookie)).value;
    assert.equal(uses(last),i);
    await until(()=>a.latest && secondTab.latest && b.latest && uses(a.latest)===i && uses(secondTab.latest)===i && uses(b.latest)===0);
    assert.ok(a.latest.presence.every(p=>!('playerKey' in p)), 'Private quota identifiers must not be broadcast');
    if(i===1) {
      await request(`/worlds/${slug}/commands`, {type:'trigger-event',eventId:'rumor'},alice.cookie,400);
      assert.equal(uses((await request(`/worlds/${slug}`,undefined,alice.cookie)).value),1,'Rejected events must not spend an allowance');
      console.log('PASS: failed events do not charge; tabs synchronize; other players retain their own allowance');
    }
  }
  const rejected = await request(`/worlds/${slug}/commands`,{type:'trigger-event',eventId:'rumor'},alice.cookie,429);
  assert.ok(Number(rejected.retry)>0); assert.equal(rejected.value.playerEvents.refillsAt.length,3);
  const refreshed = (await request(`/worlds/${slug}`,undefined,alice.cookie)).value;
  assert.deepEqual(refreshed.playerEvents,last.playerEvents);
  assert.equal(refreshed.world.history.filter(e=>e.kind==='event').length,3);
  console.log(`PASS: fourth event rejected, Retry-After provided, refresh preserves allowance, exactly three events persisted. Fixture: ${slug}`);
} finally { for(const ws of sockets)ws.close(); }
