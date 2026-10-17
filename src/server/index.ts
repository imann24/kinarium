import { refreshResidentSummaries } from '../simulation/resident-summary';
import { deployedVersion } from './build-version';
import { HouseDetailsConflict } from '../simulation/house-details';
import { DurableObject } from 'cloudflare:workers';
import { activeCharacters, advance, applyCommand, createWorld, summarize, TICK_MS } from '../simulation/engine';
import { TEMPLATES, TRAITS } from '../simulation/catalog';
import type { Command, LogEntry, Presence, Snapshot, TimeMode, WorldState, WorldSummary } from '../simulation/types';
import { body, digest, equal, json, passwordHash, string, validOrigin } from './security';
import { enrichConversation, isLLMConfigured, modelOptions, validateModelSelection, conversationCallCount, type LLMConfig } from './llm';
import { applyConversationPlan, dailyConversationLimit } from './conversation-policy';
import { availableEvents, consumeEvent, eventBudget } from '../simulation/event-budget';
import { assertAppropriate, isAppropriate } from '../simulation/content-filter';

interface Env extends LLMConfig { WORLDS: DurableObjectNamespace<WorldRoom>; DIRECTORY: DurableObjectNamespace<WorldDirectory>; ASSETS: Fetcher; }
type Stored = { world: WorldState; password?: { salt: string; hash: string }; persistedLog: number; llmDay: string; llmCalls: number; lastLLM: number; };
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const directory = (env: Env) => env.DIRECTORY.get(env.DIRECTORY.idFromName('public-directory'));
const room = (env: Env, slug: string) => env.WORLDS.get(env.WORLDS.idFromName(slug));
const internal = (path: string, data?: unknown) => new Request(`https://internal${path}`, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!validOrigin(request)) return json({ error: 'Cross-origin requests are not allowed.' }, 403);
    // Consume bounded input before crossing the Durable Object boundary. An early
    // auth rejection must not leave a forwarded client stream being read after response.
    if (request.method === 'POST') {
      try {
        const payload = await body(request);
        const headers = new Headers(request.headers); headers.delete('Content-Length');
        request = new Request(request, { headers, body: JSON.stringify(payload) });
      } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid JSON.' }, 400); }
    }
    try {
      if (url.pathname === '/api/version' && request.method === 'GET') return deployedVersion(request, env.ASSETS);
      if (url.pathname === '/api/worlds' && ['GET', 'POST'].includes(request.method)) return directory(env).fetch(request);
      if (url.pathname === '/api/templates' && request.method === 'GET') return json(Object.values(TEMPLATES));
      const match = url.pathname.match(/^\/api\/worlds\/([a-z0-9-]{1,48})(?:\/(unlock|socket|commands|history))?$/);
      if (!match || !SLUG.test(match[1])) return json({ error: 'Not found.' }, 404);
      return room(env, match[1]).fetch(request);
    } catch (error) { console.error('Request failed', error); return json({ error: 'The world is temporarily unavailable. Please try again.' }, 500); }
  },
} satisfies ExportedHandler<Env>;

export class WorldDirectory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS worlds (slug TEXT PRIMARY KEY, summary TEXT, updated INTEGER NOT NULL DEFAULT 0)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
  }
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/index') {
      const { summary, revision } = await request.json() as { summary: WorldSummary; revision: number };
      this.ctx.storage.sql.exec('INSERT INTO worlds(slug,summary,updated) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET summary=excluded.summary, updated=excluded.updated WHERE excluded.updated >= worlds.updated', summary.slug, JSON.stringify(summary), revision);
      return json({ ok: true });
    }
    try {
      if (request.method === 'GET') {
        const seed = this.ctx.storage.sql.exec('SELECT summary FROM worlds WHERE slug=?', 'the-common-house').toArray();
        if (!seed[0]?.summary) {
          const response = await room(this.env, 'the-common-house').fetch(internal('/init', { slug: 'the-common-house', name: 'The Common House', description: 'An open door, a pot of tea, and a few lives slowly intertwining.', mode: 'fast-forward', populationCap: 12 }));
          if (!response.ok) throw new Error('Could not open the common house.');
          const summary = await response.json() as WorldSummary;
          this.ctx.storage.sql.exec('INSERT INTO worlds(slug,summary) VALUES(?,?) ON CONFLICT(slug) DO NOTHING', summary.slug, JSON.stringify(summary));
        }
        return json({ worlds: this.ctx.storage.sql.exec<{ summary: string }>('SELECT summary FROM worlds WHERE summary IS NOT NULL ORDER BY updated DESC, slug ASC LIMIT 500').toArray().map(row => JSON.parse(row.summary)) });
      }
      const input = await body(request);
      const name = string(input.name, 60); const slug = string(input.slug, 48);
      if (!name || !SLUG.test(slug) || slug.length < 3 || slug === 'the-common-house') throw new Error('Choose a name and a unique slug of 3–48 lowercase letters, numbers, and single hyphens.');
      const password = string(input.password, 128);
      if (password && password.length < 4) throw new Error('Use a password of at least 4 characters.');
      const populationCap = input.populationCap ?? 12;
      if (!Number.isInteger(populationCap) || Number(populationCap) < 1 || Number(populationCap) > 40) throw new Error('Population cap must be between 1 and 40.');
      const mode = input.mode ?? 'fast-forward'; if (!['persistent', 'fast-forward'].includes(String(mode))) throw new Error('Unknown time mode.');
      const templateId = string(input.templateId, 40, 'common-house'); if (!Object.hasOwn(TEMPLATES, templateId)) throw new Error('Unknown template.');
      const description = string(input.description, 240);
      assertAppropriate(name, 'world name'); assertAppropriate(slug, 'world address'); assertAppropriate(description, 'description');
      const ip = request.headers.get('CF-Connecting-IP') || 'local'; const now = Date.now();
      this.ctx.storage.sql.exec('DELETE FROM limits WHERE expires < ?', now);
      const key = await digest(ip); const limit = this.ctx.storage.sql.exec<{ count: number }>('SELECT count FROM limits WHERE key=?', key).toArray()[0];
      if ((limit?.count ?? 0) >= 10) return json({ error: 'World creation is limited to 10 worlds per hour from this connection.' }, 429);
      if (this.ctx.storage.sql.exec('SELECT slug FROM worlds WHERE slug=?', slug).toArray().length) return json({ error: 'That world address is already taken.' }, 409);
      this.ctx.storage.sql.exec('INSERT INTO worlds(slug) VALUES(?)', slug);
      this.ctx.storage.sql.exec('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, now + 3_600_000);
      try {
        const response = await room(this.env, slug).fetch(internal('/init', { slug, name, description, password, mode, populationCap, templateId }));
        if (!response.ok) throw new Error('Could not create the world. Try again.');
        const summary = await response.json() as WorldSummary;
        this.ctx.storage.sql.exec('UPDATE worlds SET summary=?,updated=? WHERE slug=?', JSON.stringify(summary), now, slug);
        return json(summary, 201);
      } catch (error) { this.ctx.storage.sql.exec('DELETE FROM worlds WHERE slug=? AND summary IS NULL', slug); throw error; }
    } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid request.' }, 400); }
  }
}

export class WorldRoom extends DurableObject<Env> {
  private data: Stored | undefined;
  private generatingConversation = false;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    const row = ctx.storage.sql.exec<{ payload: string }>('SELECT payload FROM state WHERE id=1').toArray()[0];
    if (row) this.data = JSON.parse(row.payload);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, events TEXT NOT NULL, seen INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS players_seen ON players(seen)');
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  private save(extra?: () => void) {
    if (!this.data) return;
    const data = this.data;
    this.ctx.storage.transactionSync(() => {
      extra?.();
      for (const entry of data.world.history) if (entry.id > data.persistedLog || entry.conversation) this.ctx.storage.sql.exec('INSERT INTO history(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE history.payload != excluded.payload', entry.id, JSON.stringify(entry));
      data.persistedLog = data.world.nextLog - 1;
      data.world.history = data.world.history.slice(-80);
      refreshResidentSummaries(data.world, Date.now());
      this.ctx.storage.sql.exec('INSERT INTO state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', JSON.stringify(data));
    });
  }
  private playerEvents(id?: string): number[] {
    if (!id) return [];
    const row = this.ctx.storage.sql.exec<{ events: string }>('SELECT events FROM players WHERE id=?', id).toArray()[0];
    return row ? JSON.parse(row.events) : [];
  }
  private visitor(request: Request): { id: string; headers: Record<string, string> } {
    const token = request.headers.get('Cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('kinarium_player='))?.slice('kinarium_player='.length);
    const now = Date.now();
    if (token && /^[a-f0-9-]{36}$/.test(token) && this.ctx.storage.sql.exec('SELECT id FROM players WHERE id=?', token).toArray().length) {
      this.ctx.storage.sql.exec('UPDATE players SET seen=? WHERE id=?', now, token);
      return { id: token, headers: {} };
    }
    this.ctx.storage.sql.exec('DELETE FROM players WHERE seen < ?', now - 30 * 86_400_000);
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec('INSERT INTO players(id,events,seen) VALUES(?,?,?)', id, '[]', now);
    return { id, headers: { 'Set-Cookie': `kinarium_player=${id}; HttpOnly; SameSite=Strict; Path=/api/worlds/${this.data!.world.slug}; Max-Age=2592000${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}` } };
  }
  private snapshot(playerId?: string): Snapshot {
    const unique = new Map<string, Presence>();
    for (const ws of this.ctx.getWebSockets()) { const p = ws.deserializeAttachment() as Presence; if (p) unique.set(p.id, { id: p.id, name: p.name, color: p.color }); }
    const now = Date.now();
    return { models: modelOptions(this.env), world: this.data!.world, protected: !!this.data!.password, presence: [...unique.values()], serverNow: now, playerEvents: eventBudget(this.playerEvents(playerId), now) };
  }
  private broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      const { playerKey } = ws.deserializeAttachment() as Presence & { playerKey?: string };
      try { ws.send(JSON.stringify({ type: 'snapshot', ...this.snapshot(playerKey) })); } catch { ws.close(1011, 'Reconnect to the world'); }
    }
  }
  private async schedule() {
    if (!this.data) return;
    const occupied = this.ctx.getWebSockets().length > 0;
    if (occupied || this.data.world.settings.mode === 'persistent') {
      const desired = Date.now() + (occupied ? TICK_MS : 60_000);
      const current = await this.ctx.storage.getAlarm();
      if (!current || current > desired) await this.ctx.storage.setAlarm(desired);
    } else await this.ctx.storage.deleteAlarm();
  }
  private index() { if (this.data) this.ctx.waitUntil(directory(this.env).fetch(internal('/index', { summary: summarize(this.data.world, !!this.data.password), revision: Date.now() })).then(() => undefined).catch(error => console.error('Directory update failed', error))); }
  private limited(key: string, max: number) {
    const now = Date.now(); this.ctx.storage.sql.exec('DELETE FROM limits WHERE expires < ?', now);
    const row = this.ctx.storage.sql.exec<{ count: number }>('SELECT count FROM limits WHERE key=?', key).toArray()[0];
    if ((row?.count ?? 0) >= max) return true;
    this.ctx.storage.sql.exec('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, now + 60_000); return false;
  }
  private async authorized(request: Request) {
    if (!this.data?.password) return true;
    const token = request.headers.get('Cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith('kinarium_session='))?.slice('kinarium_session='.length);
    if (!token || token.length > 100) return false;
    const hash = await digest(token);
    return this.ctx.storage.sql.exec('SELECT token FROM sessions WHERE token=? AND expires>?', hash, Date.now()).toArray().length > 0;
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init') return this.ctx.blockConcurrencyWhile(async () => {
      if (this.data) return json(summarize(this.data.world, !!this.data.password));
      const input = await request.json() as Parameters<typeof createWorld>[0] & { password?: string };
      const salt = crypto.randomUUID();
      const password = input.password ? { salt, hash: await passwordHash(input.password, salt) } : undefined;
      this.data = { world: createWorld(input, Date.now(), crypto.getRandomValues(new Uint32Array(1))[0]), password, persistedLog: 0, llmDay: '', llmCalls: 0, lastLLM: 0 };
      this.save(); await this.schedule(); return json(summarize(this.data.world, !!password));
    });
    if (!this.data) return json({ error: 'This world does not exist yet.' }, 404);
    try {
      const ip = request.headers.get('CF-Connecting-IP') || 'local';
      if (url.pathname.endsWith('/unlock') && request.method === 'POST') {
        if (this.limited(`unlock:${ip}`, 10)) return json({ error: 'Too many password attempts. Try again in a minute.' }, 429);
        const input = await body(request); const password = string(input.password, 128);
        if (this.data.password && !equal(await passwordHash(password, this.data.password.salt), this.data.password.hash)) return json({ error: 'That password didn’t open the door.' }, 401);
        const token = crypto.randomUUID(); const now = Date.now();
        this.ctx.storage.sql.exec('DELETE FROM sessions WHERE expires < ?', now);
        this.ctx.storage.sql.exec('INSERT INTO sessions(token,expires) VALUES(?,?)', await digest(token), now + 7 * 86_400_000);
        return json({ ok: true }, 200, { 'Set-Cookie': `kinarium_session=${token}; HttpOnly; SameSite=Strict; Path=/api/worlds/${this.data.world.slug}; Max-Age=604800${url.protocol === 'https:' ? '; Secure' : ''}` });
      }
      if (!await this.authorized(request)) {
        await request.body?.cancel();
        return json({ error: 'This world has a password.', locked: true, name: this.data.world.name }, 401);
      }
      if (url.pathname.endsWith('/socket') && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
        if (this.ctx.getWebSockets().length >= 64) return json({ error: 'This world has reached its visitor limit.' }, 429);
        advance(this.data.world, Date.now()); this.save();
        const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
        const visitor = this.visitor(request);
        const playerId = (url.searchParams.get('player') || '').slice(0, 50);
        const requested = (url.searchParams.get('name') || '').slice(0, 24);
        const name = requested && isAppropriate(requested) ? requested : 'Wandering observer';
        const presence = { id: playerId || crypto.randomUUID(), name, color: ['#718564', '#b77b59', '#7396a1', '#ab8299'][name.length % 4] };
        // A reconnect can overlap the old socket, and one observer can have
        // several tabs. Keep their names consistent regardless of socket order.
        for (const ws of this.ctx.getWebSockets()) {
          const attached = ws.deserializeAttachment() as Presence & { playerKey?: string };
          if (attached?.id === presence.id) ws.serializeAttachment({ ...attached, ...presence });
        }
        server.serializeAttachment({ ...presence, playerKey: visitor.id });
        this.ctx.acceptWebSocket(server); this.broadcast(); await this.schedule();
        return new Response(null, { status: 101, webSocket: client, headers: visitor.headers });
      }
      if (url.pathname.endsWith('/history') && request.method === 'GET') {
        const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(before) || before < 1) throw new Error('Invalid history cursor.');
        const entries = this.ctx.storage.sql.exec<{ payload: string }>('SELECT payload FROM history WHERE id < ? ORDER BY id DESC LIMIT 100', before).toArray().map(row => JSON.parse(row.payload));
        return json({ entries, nextCursor: entries.length === 100 ? entries.at(-1).id : null });
      }
      if (url.pathname.endsWith('/commands') && request.method === 'POST') {
        if (this.limited(`command:${ip}`, 60)) return json({ error: 'A little too much at once. Try again in a minute.' }, 429);
        const input = await body(request); const command = this.validate(input);
        const visitor = this.visitor(request);
        const now = Date.now(); const events = this.playerEvents(visitor.id);
        const budget = eventBudget(events, now);
        if (command.type === 'trigger-event' && availableEvents(budget, now) === 0) {
          const retryAfter = Math.max(1, Math.ceil((budget.refillsAt[0] - now) / 1000));
          return json({ error: 'You’ve used your three events for now. Your next allowance is on its way.', playerEvents: budget, serverNow: now }, 429, { ...visitor.headers, 'Retry-After': String(retryAfter) });
        }
        advance(this.data.world, Date.now());
        // Work on a copy so rejected commands cannot partially mutate durable state.
        const next = structuredClone(this.data.world); applyCommand(next, command, Date.now()); this.data.world = next;
        this.save(command.type === 'trigger-event' ? () => {
          this.ctx.storage.sql.exec('UPDATE players SET events=?,seen=? WHERE id=?', JSON.stringify(consumeEvent(events, now)), now, visitor.id);
        } : undefined);
        this.broadcast(); this.index(); await this.schedule();
        return json(this.snapshot(visitor.id), 200, visitor.headers);
      }
      if (request.method === 'GET' && !/\/(socket|commands|unlock)$/.test(url.pathname)) {
        const visitor = this.visitor(request);
        advance(this.data.world, Date.now()); this.save(); await this.schedule(); return json(this.snapshot(visitor.id), 200, visitor.headers);
      }
      return json({ error: 'Method not allowed.' }, 405);
    } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid request.' }, error instanceof HouseDetailsConflict ? 409 : 400); }
  }
  private validate(input: Record<string, unknown>): Command {
    switch (input.type) {
      case 'add-character': {
        const trait = input.trait; if (trait !== undefined && !TRAITS.includes(trait as typeof TRAITS[number])) throw new Error('Unknown personality.');
        const name = string(input.name, 30), backstory = string(input.backstory, 500);
        assertAppropriate(name, 'name'); assertAppropriate(backstory, 'backstory');
        return { type: input.type, name, trait: trait as typeof TRAITS[number] | undefined, backstory };
      }
      case 'set-model': return { type: input.type, characterId: string(input.characterId, 30), model: validateModelSelection(this.env, input.model) };
      case 'set-away': if (typeof input.away !== 'boolean') throw new Error('Specify whether the character is away.'); return { type: input.type, characterId: string(input.characterId, 30), away: input.away };
      case 'trigger-event': return { type: input.type, eventId: string(input.eventId, 40) };
      case 'house-details': assertAppropriate(input.name, 'house name'); assertAppropriate(input.description, 'description'); return { type: input.type, name: input.name as string, description: input.description as string, expectedRevision: input.expectedRevision as number };
      case 'settings': return { type: input.type, mode: input.mode as TimeMode, populationCap: input.populationCap as number };
      default: throw new Error('Unknown action.');
    }
  }
  async alarm() {
    if (!this.data) return;
    advance(this.data.world, Date.now()); this.save(); this.broadcast(); await this.schedule();
    if (this.data.world.minute % 30 < 2) this.index();
    if (this.generatingConversation || !isLLMConfigured(this.env) || !this.ctx.getWebSockets().length) return;
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.llmDay !== today) { this.data.llmDay = today; this.data.llmCalls = 0; }
    const limit = dailyConversationLimit(this.env.LLM_DAILY_CALL_LIMIT);
    if (this.data.llmCalls >= limit || Date.now() - this.data.lastLLM < 8_000) return;
    const entry = this.data.world.history.find(e => e.conversation?.status === 'active' && !e.conversation.generationAttempted && e.conversation.turns.length < 4);
    if (!entry) return;
    const calls = conversationCallCount(this.env, this.data.world, entry);
    if (this.data.llmCalls + calls > limit) return;
    const selections = entry.characters.map(id => this.data!.world.characters.find(c => c.id === id)?.model);
    // Reserve every possible request before I/O. Failed requests never create retry storms.
    entry.conversation!.generationAttempted = true;
    const turnCount = entry.conversation!.turns.length;
    this.data.llmCalls += calls; this.data.lastLLM = Date.now(); this.save();
    this.generatingConversation = true;
    try {
      const turns = await enrichConversation(this.env, structuredClone(this.data.world), structuredClone(entry));
      const current = this.data.world.history.find(e => e.id === entry.id);
      // Commands can replace the world while inference is in flight; never apply a stale plan.
      if (entry.characters.some((id, i) => this.data!.world.characters.find(c => c.id === id)?.model !== selections[i])) return;
      if (!applyConversationPlan(current, turnCount, turns)) return;
      this.save(); this.broadcast();
    } finally { this.generatingConversation = false; }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) { if (message === 'ping') ws.send('pong'); else ws.close(1008, 'Use the world command API.'); }
  async webSocketClose(ws: WebSocket) { ws.close(1000, 'See you soon'); this.broadcast(); await this.schedule(); }
  async webSocketError(ws: WebSocket) { ws.close(1011, 'Connection interrupted'); this.broadcast(); await this.schedule(); }
}
