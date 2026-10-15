import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// A separate local runtime and temporary SQLite directory leave existing houses alone.
const storage = await mkdtemp(join(tmpdir(), 'kinarium-residents-'));
const port = 8791;
const origin = `http://127.0.0.1:${port}`;
let server;
let output = '';
async function start() {
  output = '';
  server = spawn(process.execPath, ['node_modules/wrangler/wrangler-dist/cli.js', 'dev', '--env', 'local', '--port', String(port), '--inspector-port', '0', '--persist-to', storage], {
    env: { ...process.env, XDG_CONFIG_HOME: join(storage, 'config'), WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-6000); });
  for (let i = 0; i < 200; i++) {
    if (server.exitCode !== null) throw new Error(output);
    if (new RegExp(`Ready on http://(?:localhost|127\\.0\\.0\\.1):${port}\\b`).test(output)) {
      try { if ((await fetch(`${origin}/api/templates`)).ok) return; } catch {}
    }
    await delay(100);
  }
  throw new Error(`Local runtime did not start: ${output}`);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = once(server, 'exit');
  server.kill('SIGINT');
  const timeout = setTimeout(() => server.kill('SIGKILL'), 10_000);
  try { await exited; } finally { clearTimeout(timeout); }
}
async function request(path, body) {
  const response = await fetch(`${origin}/api${path}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  assert.ok(response.ok, await response.clone().text());
  return response.json();
}
const identities = world => world.characters.map(({ id, name, trait, backstory, color, away, model }) => ({ id, name, trait, backstory, color, away, model }));
try {
  await start();
  const templates = await request('/templates');
  const saved = [];
  for (const template of templates) {
    const slug = `test-restart-${template.id}`;
    await request('/worlds', { slug, name: template.name, templateId: template.id, mode: 'fast-forward' });
    await request(`/worlds/${slug}/commands`, { type: 'set-away', characterId: 'c1', away: true });
    const snapshot = await request(`/worlds/${slug}`);
    assert.ok(snapshot.models.allowed.length);
    const rejected = await fetch(`${origin}/api/worlds/${slug}/commands`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'set-model',characterId:'c1',model:'not-allowed'}) });
    assert.equal(rejected.status,400);
    await request(`/worlds/${slug}/commands`, {type:'set-model',characterId:'c1',model:snapshot.models.defaultModel});
    const { world } = await request(`/worlds/${slug}`);
    assert.equal(world.characters[0].model,snapshot.models.defaultModel);
    saved.push({ slug, world });
  }
  await stop();
  await start();
  for (const { slug, world } of saved) {
    const restored = (await request(`/worlds/${slug}`)).world;
    assert.deepEqual(identities(restored), identities(world));
    assert.equal(restored.nextCharacter, world.nextCharacter);
    assert.deepEqual(restored.characters[0].memories, world.characters[0].memories);
    await request(`/worlds/${slug}/commands`, { type: 'add-character' });
    const added = (await request(`/worlds/${slug}`)).world;
    assert.deepEqual(identities(added).slice(0, 6), identities(world));
    assert.equal(added.characters.at(-1).id, 'c7');
    assert.equal(new Set(added.characters.map(c => c.name)).size, 7);
  }
  console.log('PASS: all template identities, away state, model selections, memories and ID counters survive a real SQLite runtime restart; later introductions remain unique.');
} finally {
  await stop();
  await rm(storage, { recursive: true, force: true });
}
