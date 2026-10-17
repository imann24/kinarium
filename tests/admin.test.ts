import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
vi.mock('cloudflare:workers', () => ({ DurableObject: class { constructor(public ctx: DurableObjectState, public env: unknown) {} } }));
vi.stubGlobal('WebSocketRequestResponsePair', class {});
import worker, { WorldDirectory, WorldRoom, type Env } from '../src/server/index';
import { AdminAccess } from '../src/server/admin';
import { advance } from '../src/simulation/engine';

const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
const origin = 'https://kinarium.test';
const secret = 'test-only-admin-credential';
function context() {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  let alarm: number | null = null;
  const sockets: WebSocket[] = [];
  let gate = Promise.resolve();
  const sql = { exec(query: string, ...args: (string | number)[]) { const statement = db.prepare(query); return { toArray: () => statement.all(...args) }; } };
  // Cloudflare exec runs eagerly; Node's prepared statements run on all().
  const eagerSql = { exec(query: string, ...args: (string | number)[]) { const result = sql.exec(query, ...args).toArray(); return { toArray: () => result }; } } as unknown as SqlStorage;
  const storage = { sql: eagerSql, transactionSync(fn: () => void) { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
    getAlarm: vi.fn(async () => alarm), setAlarm: vi.fn(async (time: number) => { alarm = time; }), deleteAlarm: vi.fn(async () => { alarm = null; }) };
  const ctx = { storage, getWebSockets: () => sockets, setWebSocketAutoResponse: vi.fn(), waitUntil: (p: Promise<unknown>) => { void p; },
    blockConcurrencyWhile<T>(fn: () => Promise<T>) { const result = gate.then(fn); gate = result.then(() => {}, () => {}); return result; } } as unknown as DurableObjectState;
  return { ctx, storage, sockets, sql: eagerSql, db };
}
function req(path: string, data?: unknown, cookie?: string, extra: Record<string, string> = {}) {
  return new Request(origin + path, { method: data === undefined ? 'GET' : 'POST', headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }), ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: data === undefined ? undefined : JSON.stringify(data) });
}
function setup(password: string | undefined = secret) {
  const dc = context(); const rooms = new Map<string, { instance: WorldRoom; state: ReturnType<typeof context> }>();
  const env = { KINARIUM_ADMIN_PASSWORD: password, LLM_PROVIDER: 'disabled', ASSETS: { fetch: async () => new Response('shell') } } as unknown as Env;
  const getRoom = (slug: string) => { let value = rooms.get(slug); if (!value) { const state = context(); value = { state, instance: new WorldRoom(state.ctx, env) }; rooms.set(slug, value); } return value; };
  env.WORLDS = { idFromName: (s: string) => s, get: (s: string) => ({ fetch: (r: Request) => getRoom(s).instance.fetch(r) }) } as unknown as Env['WORLDS'];
  const directory = new WorldDirectory(dc.ctx, env);
  env.DIRECTORY = { idFromName: (s: string) => s, get: () => directory } as unknown as Env['DIRECTORY'];
  const fetch = (request: Request) => worker.fetch(request, env);
  const login = async () => { const response = await fetch(req('/api/admin/login', { password: secret })); expect(response.status).toBe(200); return response.headers.get('Set-Cookie')!.split(';')[0]; };
  const create = async (slug: string) => { expect((await fetch(req('/api/worlds', { slug, name: slug, mode: 'persistent' }))).status).toBe(201); };
  return { env, dc, directory, getRoom, fetch, login, create };
}

describe('admin authentication and isolation', () => {
  it('fails closed without a secret and authenticates every admin operation', async () => {
    const app = setup('');
    for (const [path, data] of [['/houses', undefined], ['/login', { password: '' }], ['/logout', {}], ['/houses/example/delete', { confirmation: 'example' }]] as const)
      expect((await app.fetch(req('/api/admin' + path, data))).status).toBe(503);
    const enabled = setup();
    for (const [path, data] of [['/houses', undefined], ['/logout', {}], ['/houses/example/delete', { confirmation: 'example' }]] as const)
      expect((await enabled.fetch(req('/api/admin' + path, data))).status).toBe(401);
    expect((await enabled.fetch(req('/api/admin/login', { password: 'wrong' }))).status).toBe(401);
    expect((await enabled.fetch(req('/api/admin/houses', undefined, '__Host-kinarium_admin=forged'))).status).toBe(401);
  });
  it('uses expiring secure HttpOnly sessions, invalidates logout and secret rotation', async () => {
    const app = setup();
    const response = await app.fetch(req('/api/admin/login', { password: secret }));
    const cookie = response.headers.get('Set-Cookie')!;
    for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/', 'Max-Age=1800']) expect(cookie).toContain(attribute);
    expect((await app.fetch(req('/api/admin/houses', undefined, cookie.split(';')[0]))).status).toBe(200);
    expect(JSON.stringify(app.dc.sql.exec('SELECT * FROM admin_sessions').toArray())).not.toContain(cookie.split('=')[1].split(';')[0]);
    const rotated = new AdminAccess(app.dc.sql, 'rotated-test-secret');
    expect((await rotated.authorize(req('/api/admin/houses', undefined, cookie.split(';')[0])))?.status).toBe(401);
    expect((await app.fetch(req('/api/admin/logout', {}, cookie.split(';')[0]))).status).toBe(200);
    expect((await app.fetch(req('/api/admin/houses', undefined, cookie.split(';')[0]))).status).toBe(401);
    const next = await app.login();
    app.dc.sql.exec('UPDATE admin_sessions SET expires=0');
    expect((await app.fetch(req('/api/admin/houses', undefined, next))).status).toBe(401);
  });
  it('rejects cross-origin/login CSRF, missing/null Origin, sibling sites and insecure remote traffic', async () => {
    const app = setup(); const cookie = await app.login();
    for (const path of ['/api/admin/login', '/api/admin/logout', '/api/admin/houses/example/delete']) {
      for (const Origin of ['https://evil.test', 'null', '']) expect((await app.fetch(req(path, {}, cookie, { Origin }))).status).toBe(403);
      expect((await app.fetch(req(path, {}, cookie, { 'Sec-Fetch-Site': 'same-site' }))).status).toBe(403);
    }
    expect((await app.fetch(new Request('http://kinarium.test/api/admin/houses'))).status).toBe(403);
    expect((await app.fetch(req('/api/admin/houses', undefined, cookie, { Origin: 'https://evil.test' }))).status).toBe(403);
  });
  it('limits guesses durably per connection and globally, including concurrent attempts', async () => {
    const app = setup();
    const responses = await Promise.all(Array.from({ length: 10 }, () => app.fetch(req('/api/admin/login', { password: 'wrong' }))));
    expect(responses.filter(r => r.status === 401)).toHaveLength(5);
    expect(responses.filter(r => r.status === 429)).toHaveLength(5);
    const restarted = new AdminAccess(app.dc.sql, secret);
    expect((await restarted.authorize(req('/api/admin/login', { password: secret })))?.status).toBe(429);
    for (let i = 0; i < 45; i++) await app.fetch(req('/api/admin/login', { password: 'wrong' }, undefined, { 'CF-Connecting-IP': `test-${i}` }));
    const blocked = await app.fetch(req('/api/admin/login', { password: secret }, undefined, { 'CF-Connecting-IP': 'fresh' }));
    expect(blocked.status).toBe(429); expect(blocked.headers.get('Retry-After')).toBeTruthy();
    app.dc.sql.exec('UPDATE admin_limits SET expires=0'); expect(await app.login()).toBeTruthy();
  });
  it('never echoes malformed credentials and protects the admin shell from framing/caching', async () => {
    const app = setup();
    const response = await app.fetch(new Request(origin + '/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"password":"do-not-echo' }));
    expect(response.status).toBe(400); expect(await response.text()).not.toContain('do-not-echo');
    const page = await app.fetch(req('/admin'));
    expect(page.headers.get('Cache-Control')).toBe('no-store'); expect(page.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });
});

describe('permanent house deletion', () => {
  it('completes even when a socket close throws', async () => {
    const app = setup(); await app.create('stuck'); const cookie = await app.login();
    const target = app.getRoom('stuck');
    target.state.sockets.push({ close: vi.fn(() => { throw new Error('socket gone'); }) } as unknown as WebSocket);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const url = '/api/admin/houses/stuck/delete';
    expect((await app.fetch(req(url, { confirmation: 'stuck' }, cookie))).status).toBe(200);
    expect((await app.fetch(req(url, { confirmation: 'stuck' }, cookie))).status).toBe(200);
    expect(app.dc.sql.exec("SELECT completed FROM deletions WHERE slug='stuck'").toArray()).toEqual([{ completed: 1 }]);
    await expect(target.instance.webSocketClose({ close: () => { throw new Error('closed'); } } as unknown as WebSocket)).resolves.toBeUndefined();
  });
  it('requires exact confirmation, removes only the chosen house and is idempotent', async () => {
    const app = setup(); await app.create('delete-me'); await app.create('keep-me'); const cookie = await app.login();
    const target = app.getRoom('delete-me'); const other = JSON.stringify(app.getRoom('keep-me').state.sql.exec('SELECT * FROM state').toArray());
    for (const confirmation of ['', 'DELETE-ME', ' delete-me ', 'keep-me']) expect((await app.fetch(req('/api/admin/houses/delete-me/delete', { confirmation }, cookie))).status).toBe(400);
    const ws = { close: vi.fn(), send: vi.fn() } as unknown as WebSocket; target.state.sockets.push(ws);
    for (const table of ['sessions', 'players', 'limits']) expect(target.state.sql.exec(`SELECT * FROM ${table}`).toArray()).toHaveLength(0);
    await app.fetch(req('/api/worlds/delete-me')); // populate visitor and persisted history
    target.state.sql.exec("INSERT INTO sessions VALUES('test',9999999999999)");
    target.state.sql.exec("INSERT INTO limits VALUES('test',1,9999999999999)");
    for (let i = 0; i < 2; i++) expect((await app.fetch(req('/api/admin/houses/delete-me/delete', { confirmation: 'delete-me' }, cookie))).status).toBe(200);
    expect(ws.close).toHaveBeenCalledWith(1008, expect.stringContaining('deleted'));
    for (const table of ['state', 'history', 'sessions', 'limits', 'players']) expect(target.state.sql.exec(`SELECT * FROM ${table}`).toArray()).toHaveLength(0);
    expect(await target.state.storage.getAlarm()).toBeNull();
    await target.instance.alarm(); await target.instance.webSocketClose(ws);
    expect(await target.state.storage.getAlarm()).toBeNull();
    for (const tail of ['', '/history', '/socket', '/unlock', '/commands']) expect((await app.fetch(req('/api/worlds/delete-me' + tail, ['/unlock', '/commands'].includes(tail) ? {} : undefined))).status).toBe(410);
    const restarted = new WorldRoom(target.state.ctx, app.env);
    expect((await restarted.fetch(req('/init', { slug: 'delete-me', name: 'Reset' }))).status).toBe(410);
    expect((await app.fetch(req('/api/worlds', { slug: 'delete-me', name: 'Reset' }))).status).toBe(409);
    expect(JSON.stringify(app.getRoom('keep-me').state.sql.exec('SELECT * FROM state').toArray())).toBe(other);
  });
  it('rolls back a failed room erase transaction and finishes safely on retry', async () => {
    const app = setup(); await app.create('transaction-failure'); const cookie = await app.login(); const target = app.getRoom('transaction-failure');
    const exec = target.state.sql.exec.bind(target.state.sql);
    const spy = vi.spyOn(target.state.sql, 'exec').mockImplementation((query, ...args) => {
      if (query === 'DELETE FROM history') throw new Error('Injected storage failure');
      return exec(query, ...args);
    });
    expect((await app.fetch(req('/api/admin/houses/transaction-failure/delete', { confirmation: 'transaction-failure' }, cookie))).status).toBe(503);
    expect(target.state.sql.exec('SELECT * FROM state').toArray()).toHaveLength(1);
    expect(target.state.sql.exec('SELECT * FROM tombstone').toArray()).toHaveLength(0);
    spy.mockRestore();
    expect((await app.fetch(req('/api/admin/houses/transaction-failure/delete', { confirmation: 'transaction-failure' }, cookie))).status).toBe(200);
    expect(target.state.sql.exec('SELECT * FROM state').toArray()).toHaveLength(0);
  });
  it('keeps a retryable retirement after cleanup failure and rejects delayed indexing', async () => {
    const app = setup(); await app.create('partial-house'); const cookie = await app.login(); const target = app.getRoom('partial-house');
    const summary = (await (await app.fetch(req('/api/worlds'))).json() as { worlds: { slug: string }[] }).worlds.find(w => w.slug === 'partial-house');
    target.state.storage.deleteAlarm.mockRejectedValueOnce(new Error('storage temporarily unavailable'));
    expect((await app.fetch(req('/api/admin/houses/partial-house/delete', { confirmation: 'partial-house' }, cookie))).status).toBe(503);
    const list = await (await app.fetch(req('/api/admin/houses', undefined, cookie))).json() as { houses: { slug: string; status: string }[] };
    expect(list.houses.find(h => h.slug === 'partial-house')?.status).toBe('pending');
    expect((await app.directory.fetch(req('/index', { summary, revision: Date.now() + 10000 }))).status).toBe(410);
    expect((await app.fetch(req('/api/admin/houses/partial-house/delete', { confirmation: 'partial-house' }, cookie))).status).toBe(200);
    expect(await target.state.storage.getAlarm()).toBeNull();
  });
  it('does not reseed the common house, including delayed seed responses', async () => {
    const app = setup(); await app.fetch(req('/api/worlds')); const cookie = await app.login();
    expect((await app.fetch(req('/api/admin/houses/the-common-house/delete', { confirmation: 'the-common-house' }, cookie))).status).toBe(200);
    const restarted = new WorldDirectory(app.dc.ctx, app.env);
    for (let i = 0; i < 2; i++) {
      const response = await restarted.fetch(req('/api/worlds')); expect(response.status).toBe(200);
      expect((await response.json() as { worlds: unknown[] }).worlds).toHaveLength(0);
    }
  });
  it.each(['the-common-house', 'creating-house'])('discards delayed init/seed responses for %s', async slug => {
    const app = setup(); const cookie = await app.login();
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const target = app.getRoom(slug); const original = target.instance.fetch.bind(target.instance);
    let initialized = false;
    vi.spyOn(target.instance, 'fetch').mockImplementation(async request => {
      const response = await original(request);
      if (new URL(request.url).pathname === '/init') { initialized = true; await waiting; }
      return response;
    });
    const creation = app.fetch(slug === 'the-common-house' ? req('/api/worlds') : req('/api/worlds', { slug, name: slug }));
    await vi.waitFor(() => expect(initialized).toBe(true));
    // Seed GET does not reserve a directory row until init finishes. An index
    // from the initialized room makes it visible while its response is delayed.
    if (slug === 'the-common-house') await app.directory.fetch(req('/index', { summary: { slug, name: slug }, revision: 1 }));
    expect((await app.fetch(req(`/api/admin/houses/${slug}/delete`, { confirmation: slug }, cookie))).status).toBe(200);
    release(); const result = await creation;
    expect(result.status).toBe(slug === 'the-common-house' ? 200 : 410);
    expect(app.dc.sql.exec('SELECT slug FROM worlds WHERE slug=?', slug).toArray()).toHaveLength(0);
  });
  it('does not reschedule an alarm whose storage read overlaps deletion', async () => {
    const app = setup(); await app.create('alarm-race'); const target = app.getRoom('alarm-race');
    let release!: (alarm: number | null) => void;
    target.state.storage.getAlarm.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const alarm = target.instance.alarm();
    await target.instance.fetch(req('/delete', {}));
    release(null); await alarm;
    expect(await target.state.storage.getAlarm()).toBeNull();
    expect(target.state.sql.exec('SELECT * FROM state').toArray()).toHaveLength(0);
  });
  it('keeps pending cleanup retryable if the room call never executes', async () => {
    const app = setup(); await app.create('unreachable-house'); const cookie = await app.login(); const target = app.getRoom('unreachable-house');
    vi.spyOn(target.instance, 'fetch').mockRejectedValueOnce(new Error('Unavailable'));
    expect((await app.fetch(req('/api/admin/houses/unreachable-house/delete', { confirmation: 'unreachable-house' }, cookie))).status).toBe(503);
    expect(app.dc.sql.exec('SELECT * FROM deletions WHERE slug=?', 'unreachable-house').toArray()).toEqual([{ slug: 'unreachable-house', completed: 0 }]);
    expect((await app.fetch(req('/api/worlds', { slug: 'unreachable-house', name: 'Reset' }))).status).toBe(409);
    expect((await app.fetch(req('/api/admin/houses/unreachable-house/delete', { confirmation: 'unreachable-house' }, cookie))).status).toBe(200);
  });
  it('lists all houses across pages without seeding and rejects unknown deletions', async () => {
    const app = setup(); const cookie = await app.login();
    for (let i = 0; i < 105; i++) app.dc.sql.exec('INSERT INTO worlds(slug) VALUES(?)', `house-${String(i).padStart(3, '0')}`);
    const first = await (await app.fetch(req('/api/admin/houses', undefined, cookie))).json() as { houses: { slug: string }[]; next: string };
    expect(first.houses).toHaveLength(100); expect(first.next).toBe('house-099');
    const second = await (await app.fetch(req(`/api/admin/houses?after=${first.next}`, undefined, cookie))).json() as { houses: { slug: string }[]; next: string | null };
    expect(second.houses).toHaveLength(5); expect(second.next).toBeNull();
    expect((await app.fetch(req('/api/admin/houses/unknown/delete', { confirmation: 'unknown' }, cookie))).status).toBe(404);
    expect(app.dc.sql.exec('SELECT * FROM deletions').toArray()).toHaveLength(0);
  });
  it('serializes concurrent commands/init/deletion without restoring storage', async () => {
    const app = setup(); await app.create('racing-house'); const cookie = await app.login();
    const responses = await Promise.all([
      app.fetch(req('/api/worlds/racing-house/commands', { type: 'add-character' })),
      app.fetch(req('/api/admin/houses/racing-house/delete', { confirmation: 'racing-house' }, cookie)),
      app.fetch(req('/api/admin/houses/racing-house/delete', { confirmation: 'racing-house' }, cookie)),
    ]);
    expect([200, 410]).toContain(responses[0].status); expect(responses.slice(1).map(r => r.status)).toEqual([200, 200]);
    const target = app.getRoom('racing-house');
    expect((await target.instance.fetch(req('/init', { slug: 'racing-house', name: 'Reset' }))).status).toBe(410);
    expect(target.state.sql.exec('SELECT * FROM state').toArray()).toHaveLength(0);
  });
  it('aborts inference and discards its delayed response after deletion', async () => {
    const app = setup(); await app.create('generating-house'); const target = app.getRoom('generating-house');
    const data = (target.instance as unknown as { data: { world: Parameters<typeof advance>[0] } }).data;
    data.world.seed = 42;
    // Find a live conversation deterministically without changing production APIs.
    for (let i = 0; i < 300 && !data.world.history.some(e => e.conversation?.status === 'active' && !e.conversation.generationAttempted); i++) advance(data.world, data.world.lastTickAt + 4000);
    const entry = data.world.history.find(e => e.conversation?.status === 'active' && !e.conversation.generationAttempted)!;
    expect(entry).toBeTruthy();
    entry.characters = data.world.characters.slice(0, 3).map(c => c.id);
    const speakerId = entry.characters[entry.conversation!.turns.length % 3];
    let resolve!: (value: unknown) => void; let signal: AbortSignal | undefined;
    const run = vi.fn((_model, _inputs, options) => { signal = options.signal; return new Promise(r => { resolve = r; }); });
    app.env.LLM_PROVIDER = 'cloudflare'; app.env.AI = { run } as unknown as Env['AI'];
    target.state.sockets.push({ send: vi.fn(), close: vi.fn(), deserializeAttachment: () => ({ id: 'visitor' }) } as unknown as WebSocket);
    const pending = target.instance.alarm();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    await target.instance.fetch(req('/delete', {})); expect(signal?.aborted).toBe(true);
    resolve({ response: JSON.stringify({ turns: [{ speakerId, text: 'A delayed reply.' }] }) }); await pending;
    expect(target.state.sql.exec('SELECT * FROM state').toArray()).toHaveLength(0);
    expect(await target.state.storage.getAlarm()).toBeNull(); expect(run).toHaveBeenCalledTimes(1);
  });
});
