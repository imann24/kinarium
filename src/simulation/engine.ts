import { COLORS, EVENTS, TEMPLATES, TRAITS } from './catalog';
import type { Character, Command, LogKind, Relationship, WorldState, WorldSummary } from './types';

export const TICK_MS = 4_000;
export const MINUTES_PER_TICK = 2;
export const MAX_CATCHUP_STEPS = 720;
export const EVENT_COOLDOWN_MS = 45_000;
export const clamp = (n: number, low = 0, high = 100) => Math.max(low, Math.min(high, n));
export const activeCharacters = (s: WorldState) => s.characters.filter(c => !c.away);
export function random(s: WorldState) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function pick<T>(s: WorldState, items: readonly T[]): T { return items[Math.floor(random(s) * items.length)]; }
export function log(s: WorldState, kind: LogKind, text: string, characters: string[] = []) {
  const entry = { id: s.nextLog++, minute: s.minute, kind, text, characters };
  s.history.push(entry); return entry;
}
function remember(c: Character, s: WorldState, text: string) { c.memories.unshift({ text, minute: s.minute }); c.memories = c.memories.slice(0, 16); }
export function relationship(s: WorldState, a: string, b: string): Relationship {
  const [first, second] = [a, b].sort(); const key = `${first}:${second}`;
  return s.relationships[key] ??= { a: first, b: second, affinity: 0, trust: 30, encounters: 0, lastMinute: s.minute };
}
export function createCharacter(s: WorldState, name?: string, trait?: Character['trait'], backstory?: string): Character {
  if (activeCharacters(s).length >= s.settings.populationCap) throw new Error('The house is full. Raise the population cap or send someone away first.');
  if (s.characters.length >= 200) throw new Error('This world has reached its archive limit of 200 characters.');
  const number = s.nextCharacter++;
  const names = [...TEMPLATES[s.templateId].initialNames, 'Wren', 'Ira', 'Luca', 'Sage', 'Nell', 'Bea', 'Kit', 'Ember'];
  const resolvedName = name?.trim() || `${names[(number - 1) % names.length]}${number > names.length ? ` ${Math.ceil(number / names.length)}` : ''}`;
  const c: Character = {
    id: `c${number}`, name: resolvedName, trait: trait ?? pick(s, TRAITS), color: COLORS[(number - 1) % COLORS.length],
    backstory: backstory?.trim() || pick(s, [`${resolvedName} arrived with a well-worn notebook and a hope of finding somewhere to belong.`, `${resolvedName} used to live by the sea. They still open the window before making tea.`, `${resolvedName} has moved often, and is trying to learn what it means to stay.`, `${resolvedName} believes most problems can be solved by making something with your hands.`]),
    floor: Math.floor(random(s) * 3), x: 15 + random(s) * 65, destination: 0, activity: 'settling in', away: false,
    mood: 58 + random(s) * 22, energy: 65 + random(s) * 25, belonging: 35, memories: [],
  };
  c.destination = c.floor;
  for (const other of s.characters) relationship(s, c.id, other.id);
  s.characters.push(c); log(s, 'arrival', `${c.name} arrives at the house. A new story begins.`, [c.id]);
  remember(c, s, 'My first day in the house.'); return c;
}
export function createWorld(input: { slug: string; name: string; description?: string; mode?: WorldState['settings']['mode']; populationCap?: number; templateId?: string }, now = Date.now(), seed = 271828): WorldState {
  const templateId = input.templateId ?? 'common-house';
  if (!TEMPLATES[templateId]) throw new Error('Unknown world template.');
  const metrics = TEMPLATES[templateId].initialMetrics ?? { cohesion: 62, tension: 18, resources: 75 };
  const s: WorldState = { version: 1, slug: input.slug, name: input.name, description: input.description || 'A small place to belong. Let’s see what grows here.', templateId, createdAt: now,
    settings: { mode: input.mode ?? 'fast-forward', populationCap: input.populationCap ?? 12 }, minute: 8 * 60, lastTickAt: now,
    seed, nextCharacter: 1, characters: [], relationships: {}, history: [], nextLog: 1, ...metrics,
    elevatorFloor: 0, elevatorDirection: 1, elevatorPhase: 'stopped', cooldowns: {}, lastRitualDay: -1 };
  log(s, 'world', 'The doors open. A little world begins.');
  for (let i = 0; i < Math.min(6, s.settings.populationCap); i++) createCharacter(s, TEMPLATES[templateId].initialNames[i], TRAITS[i % TRAITS.length]);
  return s;
}
function interact(s: WorldState, a: Character, b: Character) {
  const r = relationship(s, a.id, b.id);
  const scarcity = s.resources < 25 ? .15 : 0;
  const kindness = (a.trait === 'kind' || b.trait === 'kind') ? .13 : 0;
  const positive = random(s) > clamp(.19 + s.tension / 240 + scarcity - kindness - r.affinity / 400, .06, .87);
  const previous = r.affinity;
  r.affinity = clamp(r.affinity + (positive ? 4 : -7), -100, 100);
  r.trust = clamp(r.trust + (positive ? 2 : -4)); r.encounters++; r.lastMinute = s.minute;
  a.mood = clamp(a.mood + (positive ? 3 : -5)); b.mood = clamp(b.mood + (positive ? 3 : -5));
  a.belonging = clamp(a.belonging + (positive ? 2 : -3)); b.belonging = clamp(b.belonging + (positive ? 2 : -3));
  s.cohesion = clamp(s.cohesion + (positive ? .5 : -.9)); s.tension = clamp(s.tension + (positive ? -.5 : 1.2));
  const speech = positive ? pick(s, ['I saved you a seat.', 'It feels a little like home here.', 'Want to make something together?', 'Tell me more about that.', 'I’m glad you’re here.', 'The garden is doing well today.']) : pick(s, ['I wish you had asked first.', 'We can’t keep ignoring this.', 'I need a little space.', 'That’s not what I meant.']);
  a.speech = speech; a.speechUntil = s.minute + 6; a.activity = positive ? `talking with ${b.name}` : `disagreeing with ${b.name}`;
  b.activity = positive ? `listening to ${a.name}` : `disagreeing with ${a.name}`;
  const text = `${a.name} ${positive ? 'shares a moment with' : 'clashes with'} ${b.name}. “${speech}”`;
  log(s, positive ? 'conversation' : 'conflict', text, [a.id, b.id]);
  if (!positive || r.encounters % 4 === 0) { remember(a, s, text); remember(b, s, text); }
  if (previous < 35 && r.affinity >= 35) { const t = `${a.name} and ${b.name} are becoming real friends.`; log(s, 'friendship', t, [a.id, b.id]); remember(a, s, t); remember(b, s, t); }
}
export function step(s: WorldState) {
  s.minute += MINUTES_PER_TICK;
  const people = activeCharacters(s);
  const template = TEMPLATES[s.templateId];
  // A travel tick is followed by a complete stopped tick for boarding/exiting.
  // Older saved worlds have no phase; resume them from a stopped landing.
  if ((s.elevatorPhase ?? 'stopped') === 'stopped') {
    s.elevatorPhase = 'moving';
    s.elevatorFloor += s.elevatorDirection;
    if (s.elevatorFloor >= template.floors.length - 1 || s.elevatorFloor <= 0) s.elevatorDirection *= -1;
  } else s.elevatorPhase = 'stopped';
  const night = s.minute % 1440 < 360 || s.minute % 1440 > 1320;
  for (const c of people) {
    if ((c.speechUntil ?? 0) < s.minute) c.speech = undefined;
    c.energy = clamp(c.energy + (night || c.floor === 1 ? 1.8 : -.35));
    c.belonging = clamp(c.belonging - .025);
    c.mood = clamp(c.mood + (s.resources < 20 ? -.2 : .035) + (c.belonging - 50) / 2000 - s.tension / 4000);
    if (c.inElevator) {
      c.floor = s.elevatorFloor;
      c.activity = 'riding the elevator';
      if (s.elevatorPhase === 'stopped' && c.floor === c.destination) { c.inElevator = false; c.x = 84; c.activity = 'stepping out of the elevator'; }
    } else if (c.destination !== c.floor) {
      c.x = Math.min(94, c.x + 15); c.activity = 'waiting for the elevator';
      if (s.elevatorPhase === 'stopped' && c.x >= 90 && s.elevatorFloor === c.floor) { c.inElevator = true; c.activity = 'riding the elevator'; }
    } else if (random(s) < .12) {
      c.destination = night || c.energy < 20 ? 1 : Math.floor(random(s) * template.floors.length);
      c.activity = c.destination === c.floor ? template.floors[c.floor].purpose : 'heading to the elevator';
    } else { c.x = clamp(c.x + (random(s) - .5) * 18, 8, 84); if (!c.speech) c.activity = night ? 'resting' : (template.floors[c.floor].activity ?? ['making tea', 'reading', 'tending the plants'][c.floor]); }
  }
  if (people.length > 1 && random(s) < .48) {
    const a = pick(s, people); const nearby = people.filter(b => b.id !== a.id && !b.inElevator && !a.inElevator && b.floor === a.floor && b.destination === b.floor && a.destination === a.floor);
    if (nearby.length) interact(s, a, pick(s, nearby));
  }
  s.resources = clamp(s.resources - people.length * .008 + people.filter(c => c.floor === 2 && c.trait === 'practical').length * .12);
  // Scarcity and unresolved conflict can erode a community; high trust supports repair.
  if (s.resources < 20) { s.tension = clamp(s.tension + .06); s.cohesion = clamp(s.cohesion - .04); }
  if (s.minute % 120 === 0) {
    for (const r of Object.values(s.relationships)) {
      if (s.minute - r.lastMinute > 720) { r.affinity *= .985; r.trust = clamp(r.trust - .2); }
    }
  }
  const day = Math.floor(s.minute / 1440);
  if (s.minute % 1440 >= 1080 && s.lastRitualDay < day && people.length >= 2) {
    s.lastRitualDay = day;
    if (s.cohesion > 45) { log(s, 'ritual', 'As evening settles, the house gathers for tea. An ordinary habit becomes a little tradition.', people.map(c => c.id)); s.cohesion = clamp(s.cohesion + 3); s.resources = clamp(s.resources + 8); for (const c of people) remember(c, s, 'We gathered for evening tea.'); }
    else { log(s, 'ritual', 'Evening comes, but the common table stays quiet. Everyone keeps to their own corner.'); s.tension = clamp(s.tension + 2); }
  }
}
export function advance(s: WorldState, now: number) {
  const elapsed = Math.max(0, Math.floor((now - s.lastTickAt) / TICK_MS));
  const count = Math.min(elapsed, MAX_CATCHUP_STEPS);
  if (elapsed > count) { s.minute += (elapsed - count) * MINUTES_PER_TICK; log(s, 'world', 'A long quiet interval passes. The most recent day is remembered in detail.'); }
  for (let i = 0; i < count; i++) step(s);
  s.lastTickAt += elapsed * TICK_MS;
  return count;
}
export function applyCommand(s: WorldState, command: Command, now: number) {
  switch (command.type) {
    case 'add-character': createCharacter(s, command.name, command.trait, command.backstory); break;
    case 'set-away': {
      const c = s.characters.find(c => c.id === command.characterId);
      if (!c) throw new Error('That character could not be found.');
      if (c.away === command.away) return;
      if (!command.away && activeCharacters(s).length >= s.settings.populationCap) throw new Error('The house is full. Make some room before welcoming them back.');
      c.away = command.away; c.inElevator = false; c.destination = c.floor; c.x = Math.min(c.x, 84); c.speech = undefined; c.activity = c.away ? 'away for a while' : 'finding their feet again';
      log(s, c.away ? 'departure' : 'arrival', `${c.name} ${c.away ? 'leaves for a while. Their place in the story remains.' : 'returns to the house. There is a familiar face at the door.'}`, [c.id]);
      remember(c, s, c.away ? 'I took some time away from the house.' : 'I came back to the house.'); break;
    }
    case 'trigger-event': {
      const event = EVENTS.find(e => e.id === command.eventId);
      if (!event) throw new Error('Unknown event.');
      if ((s.cooldowns.events ?? 0) > now) throw new Error('Let this moment settle before introducing another event.');
      s.cooldowns.events = now + EVENT_COOLDOWN_MS;
      s.cohesion = clamp(s.cohesion + event.cohesion); s.tension = clamp(s.tension + event.tension); s.resources = clamp(s.resources + event.resources);
      const people = activeCharacters(s);
      for (const c of people) { c.mood = clamp(c.mood + event.mood); remember(c, s, event.text); if (event.tone === 'kind') c.destination = 0; }
      for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) { const r = relationship(s, people[i].id, people[j].id); r.affinity = clamp(r.affinity + (event.tone === 'kind' ? 3 : -2), -100, 100); r.trust = clamp(r.trust + (event.tone === 'kind' ? 2 : -2)); }
      log(s, 'event', event.text, people.map(c => c.id)); break;
    }
    case 'settings': {
      if (!Number.isInteger(command.populationCap) || command.populationCap < 1 || command.populationCap > 40) throw new Error('Population cap must be between 1 and 40.');
      if (!['persistent', 'fast-forward'].includes(command.mode)) throw new Error('Unknown time mode.');
      if (command.populationCap < activeCharacters(s).length) throw new Error('Send characters away before lowering the cap below the current population.');
      s.settings = { mode: command.mode, populationCap: command.populationCap }; log(s, 'world', `The world now uses ${command.mode} time, with room for ${command.populationCap} residents.`); break;
    }
    default: throw new Error('Unknown action.');
  }
}
export function summarize(s: WorldState, protectedWorld: boolean): WorldSummary {
  return { slug: s.slug, name: s.name, description: s.description, templateId: s.templateId, createdAt: s.createdAt, population: activeCharacters(s).length, populationCap: s.settings.populationCap, mode: s.settings.mode, protected: protectedWorld, cohesion: Math.round(s.cohesion) };
}
export function gameTime(minute: number) { return `Day ${Math.floor(minute / 1440) + 1} · ${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }
