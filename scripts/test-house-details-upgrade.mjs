// Real version-skew regression: current built UI, pre-edit Worker, then an in-place
// Worker upgrade over the same SQLite state. Never contacts a deployed world.
// Requires `pnpm build`; PLAYWRIGHT_MODULE and CHROMIUM_PATH are optional.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, symlink, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = process.cwd();
const directory = await mkdtemp(join(tmpdir(), 'kinarium-house-upgrade-'));
const port = Number(process.env.UPGRADE_TEST_PORT || 8791);
assert(Number.isInteger(port) && port >= 1024 && port < 65536);
const base = `http://127.0.0.1:${port}`;
const slug = 'test-existing-house';
const logs = await open(join(directory, 'worker.log'), 'a');
let server, browser;
function extract(ref) {
  const archive = execFileSync('git', ['archive', ref, 'src', 'wrangler.jsonc'], { cwd: root });
  execFileSync('tar', ['-x', '-C', directory], { input: archive });
}
async function start() {
  server = spawn(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--env', 'local', '--port', String(port)], {
    cwd: directory, detached: true, env: { ...process.env, XDG_CONFIG_HOME: join(directory, 'config'), WRANGLER_SEND_METRICS: 'false' }, stdio: ['ignore', logs.fd, logs.fd],
  });
  for (let i = 0; i < 150; i++) {
    if (server.exitCode !== null) throw new Error(`Worker exited; inspect ${directory}/worker.log`);
    try { if ((await fetch(base + '/api/templates')).ok) return; } catch { /* starting */ }
    await delay(200);
  }
  throw new Error(`Worker did not start; inspect ${directory}/worker.log`);
}
async function stop() {
  if (!server) return;
  const child = server; server = undefined;
  const exited = new Promise(resolve => child.once('exit', resolve));
  process.kill(-child.pid, 'SIGTERM'); await exited;
  for (let i = 0; i < 50; i++) { try { await fetch(base + '/api/templates'); await delay(100); } catch { return; } }
  throw new Error('Worker port did not close');
}
try {
  extract('2bc4a4e283f3a1072fa85743ba1342d43440dd31'); // Last main before house editing.
  await symlink(resolve(root, 'node_modules'), join(directory, 'node_modules'));
  await symlink(resolve(root, 'dist'), join(directory, 'dist'));
  await start();
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const response = await page.request.post(base + '/api/worlds', { data: { slug, name: 'Existing house', description: 'Saved by the earlier Worker' } });
  assert.equal(response.status(), 201);
  const before = (await (await page.request.get(`${base}/api/worlds/${slug}`)).json()).world;
  assert.equal(before.detailsRevision, undefined);
  await page.goto(`${base}/w/${slug}`);
  await page.getByRole('button', { name: 'World settings', exact: true }).click();
  await page.getByLabel('House name', { exact: true }).fill('Renamed existing house');
  await page.getByLabel('Description', { exact: true }).fill('The retained draft');
  const rejected = page.waitForResponse(r => r.url().endsWith('/commands'));
  await page.getByRole('button', { name: 'Save house details', exact: true }).click();
  const rejection = await rejected;
  assert.equal(rejection.status(), 400);
  assert.deepEqual(await rejection.json(), { error: 'Unknown action.' });
  await page.getByRole('alert').filter({ hasText: 'This server does not support editing house details yet.' }).waitFor();
  assert.equal(await page.locator('#house-name').inputValue(), 'Renamed existing house');
  assert.equal((await (await page.request.get(`${base}/api/worlds/${slug}`)).json()).world.name, before.name);
  console.log('PASS: current frontend + real older Worker reproduces rejection, explains server update, retains draft and leaves stored details unchanged');
  await stop(); extract('HEAD'); await start();
  await page.getByRole('button', { name: 'Save house details', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'House details saved.' }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload(); await page.getByRole('heading', { name: /Renamed existing house/ }).waitFor();
  const after = (await (await page.request.get(`${base}/api/worlds/${slug}`)).json()).world;
  assert.equal(after.name, 'Renamed existing house'); assert.equal(after.description, 'The retained draft'); assert.equal(after.detailsRevision, 1);
  assert.equal(after.slug, before.slug); assert.equal(after.createdAt, before.createdAt); assert.deepEqual(after.settings, before.settings);
  assert.deepEqual(after.characters.map(c => c.id), before.characters.map(c => c.id));
  const history = (await (await page.request.get(`${base}/api/worlds/${slug}/history`)).json()).entries;
  for (const entry of before.history) assert.ok(history.some(saved => saved.id === entry.id && saved.text === entry.text));
  const summary = (await (await page.request.get(base + '/api/worlds')).json()).worlds.find(w => w.slug === slug);
  assert.equal(summary.name, after.name); assert.equal(summary.description, after.description);
  console.log('PASS: retry after an in-place Worker upgrade saves the retained draft; older SQLite world, URL, residents, history and unrelated settings survive; directory/header/reload agree');
} finally { await browser?.close(); await stop(); await logs.close(); await rm(directory, { recursive: true, force: true }); }
