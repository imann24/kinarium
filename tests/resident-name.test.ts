import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
vi.mock('cloudflare:workers', () => ({ DurableObject: class { constructor(public ctx: DurableObjectState, public env: unknown) {} } }));
vi.stubGlobal('WebSocketRequestResponsePair', class {});
import worker, { WorldDirectory, WorldRoom, type Env } from '../src/server/index';
import { applyCommand, createWorld } from '../src/simulation/engine';
import { beginConversation } from '../src/simulation/conversations';
import { enrichConversation, enrichDialogue } from '../src/server/llm';
import type { Snapshot, WorldState } from '../src/simulation/types';

const databases: DatabaseSync[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.restoreAllMocks(); });
const origin = 'https://kinarium.test';
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
function setup() {
  const dc = context(); const rooms = new Map<string, { instance: WorldRoom; state: ReturnType<typeof context> }>();
  const env = { LLM_PROVIDER: 'disabled', ASSETS: { fetch: async () => new Response('shell') } } as unknown as Env;
  const getRoom = (slug: string) => { let value = rooms.get(slug); if (!value) { const state = context(); value = { state, instance: new WorldRoom(state.ctx, env) }; rooms.set(slug, value); } return value; };
  env.WORLDS = { idFromName: (s: string) => s, get: (s: string) => ({ fetch: (r: Request) => getRoom(s).instance.fetch(r) }) } as unknown as Env['WORLDS'];
  const directory = new WorldDirectory(dc.ctx, env);
  env.DIRECTORY = { idFromName: (s: string) => s, get: () => directory } as unknown as Env['DIRECTORY'];
  const fetch = (request: Request) => worker.fetch(request, env);
  const create = async (slug: string) => { expect((await fetch(req('/api/worlds', { slug, name: slug, mode: 'persistent' }))).status).toBe(201); };
  return { env, getRoom, fetch, create };
}

const rename = (name: string, characterId = 'c1') => ({ type: 'rename-character' as const, characterId, name });
const fixture = () => {
  const world = createWorld({ slug: 'names', name: 'Names' }, 0, 42);
  world.characters.slice(0, 2).forEach(c => Object.assign(c, { x: 20, floor: 0, destination: 0 }));
  return world;
};

describe('resident names', () => {
  it('changes only the name, including away residents, and repeats without side effects', () => {
    const world = fixture(); world.characters[0].away = true;
    const before = structuredClone(world);
    applyCommand(world, rename('  Ellis  '), 0);
    before.characters[0].name = 'Ellis';
    expect(world).toEqual(before);
    applyCommand(world, rename('Ellis'), 0);
    expect(world).toEqual(before);
    applyCommand(world, rename('Nora'), 0);
    before.characters[0].name = 'Nora'; expect(world).toEqual(before);
    expect(JSON.parse(JSON.stringify(world))).toEqual(JSON.parse(JSON.stringify(before)));
  });
  it('permits explicit duplicates like introductions while automatic names stay unique', () => {
    const world = fixture();
    applyCommand(world, rename(world.characters[1].name), 0);
    expect(world.characters[0].name).toBe(world.characters[1].name);
    expect(world.characters[0].id).not.toBe(world.characters[1].id);
    applyCommand(world, { type: 'add-character' }, 0);
    expect(world.characters.slice(0, -1).map(c => c.name)).not.toContain(world.characters.at(-1)!.name);
  });
  it.each(['', '  \t\n', 'x'.repeat(31), null, 17, {}, undefined, 'fuck'])('rejects invalid names without a partial mutation: %s', name => {
    const world = fixture(); const before = structuredClone(world);
    expect(() => applyCommand(world, rename(name as string), 0)).toThrow(); expect(world).toEqual(before);
  });
  it('accepts boundary length, Unicode and punctuation; rejects unknown ids', () => {
    const world = fixture();
    for (const name of ['É', 'A'.repeat(30), 'Renée O’Neil', '小雨']) {
      applyCommand(world, rename(name), 0); expect(world.characters[0].name).toBe(name);
    }
    const before = structuredClone(world);
    expect(() => applyCommand(world, rename('Ellis', 'unknown'), 0)).toThrow('could not be found');
    expect(world).toEqual(before);
  });
  it('updates active labels and discards only unspoken AI plans, retaining identity and history', () => {
    const world = fixture(); const [a, b] = world.characters;
    const entry = beginConversation(world, a, b, true);
    entry.conversation!.planned = [{ speakerId: b.id, text: `Hello, ${a.name}.` }];
    const before = structuredClone(world);
    applyCommand(world, rename('Ellis', a.id), 0);
    before.characters[0].name = 'Ellis';
    before.characters[1].activity = 'listening to Ellis';
    delete before.history.at(-1)!.conversation!.planned;
    expect(world).toEqual(before);
    expect(entry.text).not.toContain('Ellis');
    expect(b.activity).toBe('listening to Ellis');
  });
  it('sends current names and explicit historical-name guidance to both AI paths', async () => {
    const world = fixture(); const entry = beginConversation(world, world.characters[0], world.characters[1], true);
    const oldBackstory = world.characters[0].backstory;
    applyCommand(world, rename('Ellis'), 0);
    const run = vi.fn().mockResolvedValue({ response: 'invalid' });
    await enrichConversation({ AI: { run } }, world, entry);
    await enrichDialogue({ AI: { run } }, world, entry);
    expect(run).toHaveBeenCalledTimes(2);
    for (const [, inputs] of run.mock.calls as unknown as [string, { messages: {content:string}[] }][]) {
      expect(inputs.messages[0].content).toContain('current name field');
      const data = JSON.parse(inputs.messages[1].content);
      expect(data.characters[0].name).toBe('Ellis');
      expect(data.characters[0].backstory).toBe(oldBackstory);
    }
  });
});

describe('resident rename API and storage', () => {
  it('persists through object reconstruction, broadcasts by id, and isolates the other house', async () => {
    const app = setup(); await app.create('rename-me'); await app.create('keep-me');
    const target = app.getRoom('rename-me');
    const other = app.getRoom('keep-me').state.sql.exec('SELECT * FROM state').toArray();
    const before = (await (await app.fetch(req('/api/worlds/rename-me'))).json() as Snapshot).world;
    const archived = target.state.sql.exec('SELECT * FROM history').toArray();
    const send = vi.fn();
    target.state.sockets.push({ send, deserializeAttachment: () => ({ id: 'watcher' }) } as unknown as WebSocket);
    const response = await app.fetch(req('/api/worlds/rename-me/commands', rename('  Ellis  ')));
    expect(response.status).toBe(200);
    expect((await response.json() as Snapshot).world.characters[0].name).toBe('Ellis');
    expect(JSON.parse(send.mock.calls.at(-1)![0]).world.characters[0]).toMatchObject({ id: 'c1', name: 'Ellis' });
    const restarted = new WorldRoom(target.state.ctx, app.env);
    const restored = (await (await restarted.fetch(req('/api/worlds/rename-me'))).json() as Snapshot).world;
    expect(restored.characters[0]).toEqual({ ...before.characters[0], name: 'Ellis' });
    expect(restored.relationships).toEqual(before.relationships);
    expect(restored.history).toEqual(before.history);
    expect(restored.nextCharacter).toBe(before.nextCharacter);
    expect(target.state.sql.exec('SELECT * FROM history').toArray()).toEqual(archived);
    expect(app.getRoom('keep-me').state.sql.exec('SELECT * FROM state').toArray()).toEqual(other);
  });
  it('validates requests and honors the existing password and origin boundary', async () => {
    const app = setup();
    await app.fetch(req('/api/worlds', { slug: 'locked-names', name: 'Names', password: 'local-only', mode: 'fast-forward' }));
    const path = '/api/worlds/locked-names/commands';
    expect((await app.fetch(req(path, rename('Ellis')))).status).toBe(401);
    const unlock = await app.fetch(req('/api/worlds/locked-names/unlock', { password: 'local-only' }));
    const cookie = unlock.headers.get('Set-Cookie')!.split(';')[0];
    const target = app.getRoom('locked-names');
    const before = target.state.sql.exec('SELECT * FROM state').toArray();
    for (const name of ['', '   ', 'x'.repeat(31), 17, null, {}, 'fuck']) {
      expect((await app.fetch(req(path, { ...rename(''), name }, cookie))).status).toBe(400);
      expect(target.state.sql.exec('SELECT * FROM state').toArray()).toEqual(before);
    }
    expect((await app.fetch(req(path, rename('Ellis', 'missing'), cookie))).status).toBe(400);
    expect((await app.fetch(req(path, rename('Ellis'), cookie, { Origin: 'https://elsewhere.test' }))).status).toBe(403);
    expect((await app.fetch(req(path, rename('Ellis'), cookie))).status).toBe(200);
    expect((await app.fetch(req(path, rename('Ellis'), cookie))).status).toBe(200);
  });
  it('discards an in-flight AI result after any resident name changes', async () => {
    const app = setup(); await app.create('generating-names'); const target = app.getRoom('generating-names');
    const data = (target.instance as unknown as { data: { world: WorldState } }).data;
    const [a, b] = data.world.characters;
    for (const c of [a, b]) Object.assign(c, { x: 20, floor: 0, destination: 0 });
    const entry = beginConversation(data.world, a, b, true);
    let resolve!: (value: unknown) => void;
    const run = vi.fn(() => new Promise(r => { resolve = r; }));
    app.env.LLM_PROVIDER = 'cloudflare'; app.env.AI = { run } as unknown as Env['AI'];
    target.state.sockets.push({ send: vi.fn(), deserializeAttachment: () => ({ id: 'visitor' }) } as unknown as WebSocket);
    const pending = target.instance.alarm();
    await vi.waitFor(() => expect(run).toHaveBeenCalled());
    expect((await app.fetch(req('/api/worlds/generating-names/commands', rename('Ellis', 'c3')))).status).toBe(200);
    resolve({ response: JSON.stringify({ turns: [b.id, a.id, b.id].map(speakerId => ({ speakerId, text: 'A delayed reply.' })) }) });
    await pending;
    const current = data.world.history.find(e => e.id === entry.id)!;
    expect(current.conversation!.planned).toBeUndefined();
    expect(current.conversation!.turns).toEqual(entry.conversation!.turns);
  });
});
