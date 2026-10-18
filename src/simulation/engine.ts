import { renameResident } from './resident-name';
import { communityDrift, communityStats, recordCommunityChange } from './community-state';
import { advanceQuietCompanionship } from './companionship';
import { separateStandingResidents } from './standing';
import { bestTrust, residentDrift, residentStats, recordResidentChange } from './resident-state';
import { contactWillingness, repairScene } from './repair';
import { advanceGestures, choosePartners, reactToEvent } from './event-reactions';
import { eventConsequences } from './event-consequences';
import { GOODWILL_DECAY_PER_DAY, isEased, settleEasedConflict } from './goodwill';
import { updateHouseDetails } from './house-details';
import { advanceConversations, beginConversation, nearby as inConversationRange, isConversing, interruptConversations } from './conversations';
import { memoryInfluence, rememberEvent } from './memories';
import { recordEncounter, recordFriendship, recordSharedEvent } from './relationship-story';
import { COLORS, EVENTS, TEMPLATES, TRAITS } from './catalog';
import { validateAppearance } from './appearance';
import type { Character, Command, LogEntry, LogKind, Relationship, WorldState, WorldSummary, WorldTemplate } from './types';

export const TICK_MS = 4_000;
export const MINUTES_PER_TICK = 2;
export const MAX_CATCHUP_STEPS = 720;
export const EVENT_COOLDOWN_MS = 45_000;
/** Warmth within a day of a refused approach counts as a turnaround. */
export const TURNAROUND_MINUTES = 1440;
/** Share of a quarrel's cost when the pair's disagreement is already open. */
export const FLARE_UP = .6;
/** How long a material gift eases supply worries. */
export const RELIEF_MINUTES = 360;
export const clamp = (n: number, low = 0, high = 100) => Math.max(low, Math.min(high, n));
export const activeCharacters = (s: WorldState) => s.characters.filter(c => !c.away);
export function random(s: WorldState) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
function pick<T>(s: WorldState, items: readonly T[]): T { return items[Math.floor(random(s) * items.length)]; }
export function log(s: WorldState, kind: LogKind, text: string, characters: string[] = []) {
  const entry: LogEntry = { id: s.nextLog++, minute: s.minute, kind, text, characters };
  s.history.push(entry); return entry;
}
export function relationship(s: WorldState, a: string, b: string): Relationship {
  const [first, second] = [a, b].sort(); const key = `${first}:${second}`;
  return s.relationships[key] ??= { a: first, b: second, affinity: 0, trust: 30, encounters: 0, lastMinute: s.minute };
}
export function createCharacter(s: WorldState, name?: string, trait?: Character['trait'], backstory?: string): Character {
  if (activeCharacters(s).length >= s.settings.populationCap) throw new Error('The house is full. Raise the population cap or send someone away first.');
  if (s.characters.length >= 200) throw new Error('This world has reached its archive limit of 200 characters.');
  const number = s.nextCharacter++;
  const names = [...TEMPLATES[s.templateId].initialNames, 'Wren', 'Ira', 'Luca', 'Sage', 'Nell', 'Bea', 'Kit', 'Ember'];
  let resolvedName = name?.trim() || `${names[(number - 1) % names.length]}${number > names.length ? ` ${Math.ceil(number / names.length)}` : ''}`;
  // Random starters may already use a later automatic name; include away residents.
  if (!name?.trim()) {
    const base = resolvedName;
    let suffix = 2;
    while (s.characters.some(c => c.name === resolvedName)) resolvedName = `${base} ${suffix++}`;
  }
  const c: Character = {
    id: `c${number}`, name: resolvedName, trait: trait ?? pick(s, TRAITS), color: COLORS[(number - 1) % COLORS.length],
    backstory: backstory?.trim() || pick(s, [`${resolvedName} arrived with a well-worn notebook and a hope of finding somewhere to belong.`, `${resolvedName} used to live by the sea. They still open the window before making tea.`, `${resolvedName} has moved often, and is trying to learn what it means to stay.`, `${resolvedName} believes most problems can be solved by making something with your hands.`]),
    floor: Math.floor(random(s) * 3), x: 15 + random(s) * 65, destination: 0, activity: 'settling in', away: false,
    mood: 58 + random(s) * 22, energy: 65 + random(s) * 25, belonging: 35, memories: [],
  };
  c.destination = c.floor;
  const [low, high] = floorSpan(TEMPLATES[s.templateId], c.floor); c.x = clamp(c.x, low, high);
  for (const other of s.characters) relationship(s, c.id, other.id);
  s.characters.push(c); const arrival = log(s, 'arrival', `${c.name} arrives at the house. A new story begins.`, [c.id]);
  rememberEvent(c, arrival, 'I arrived at the house, ready to begin a new chapter.', { salience: 5 });
  separateStandingResidents(s); return c;
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
  // Draw without replacement only at creation. Persist the resulting characters as usual.
  const candidates = [...TEMPLATES[templateId].starterResidents];
  for (let i = 0; i < Math.min(6, s.settings.populationCap); i++) {
    const [profile] = candidates.splice(Math.floor(random(s) * candidates.length), 1);
    createCharacter(s, profile.name, profile.trait, profile.backstory);
  }
  return s;
}
function interact(s: WorldState, a: Character, b: Character) {
  const beforeA = residentStats(a), beforeB = residentStats(b);
  const beforeCommunity = communityStats(s);
  const r = relationship(s, a.id, b.id);
  const repair = repairScene(s, a, b, r, random(s));
  if (repair) { beginConversation(s, a, b, true, repair); return; }
  const scarcity = s.resources < 25 ? .15 : 0;
  const kindness = (a.trait === 'kind' || b.trait === 'kind') ? .13 : 0;
  const relief = (s.reliefUntil ?? -Infinity) > s.minute ? .08 : 0;
  const positive = random(s) > clamp(.19 + s.tension / 400 + scarcity - kindness - relief - r.affinity / 400 - (memoryInfluence(a, b.id, s.minute) + memoryInfluence(b, a.id, s.minute)) / 2, .06, .87);
  // Warm contact is welcome, but repeated greetings cannot wash out a conflict.
  const reward = s.minute - (r.lastConnectionMinute ?? -Infinity) >= 120;
  const unresolved = !!r.unresolvedConflict;
  // Once goodwill eases a disagreement, warm contact recovers at half the usual rate.
  const eased = isEased(r);
  const recovery = reward ? 1 : 0;
  const rate = (open: number, easing: number, normal: number) => unresolved ? (eased ? easing : open) : normal;
  // Another quarrel over an open disagreement reopens an old wound rather than making a new one.
  const flare = unresolved ? FLARE_UP : 1;
  const moodChange = positive ? recovery * rate(1, 1.5, 3) : -5 * flare;
  const belongingChange = positive ? recovery * rate(.5, 1, 2) : -3 * flare;
  const previous = r.affinity;
  r.affinity = clamp(r.affinity + (positive ? recovery * rate(1, 2, 4) : -7 * flare), -100, 100);
  r.trust = clamp(r.trust + (positive ? recovery * rate(0, .5, 2) : -4 * flare));
  r.encounters++; r.lastMinute = s.minute;
  // Someone already low has less left to lose to one more hard moment.
  const sting = (value: number) => positive ? 1 : .4 + .6 * value / 100;
  for (const c of [a, b]) {
    c.mood = clamp(c.mood + moodChange * sting(c.mood));
    c.belonging = clamp(c.belonging + belongingChange * sting(c.belonging));
  }
  s.cohesion = clamp(s.cohesion + (positive ? recovery * rate(0, .25, .5) : -.9 * flare));
  // A house already near its limit has less room left to tighten.
  s.tension = clamp(s.tension + (positive ? -recovery * rate(0, .25, .5) : 1.2 * flare * (1 - s.tension / 150)));
  if (positive && reward) r.lastConnectionMinute = s.minute;
  const encounter = beginConversation(s, a, b, positive);
  recordEncounter(r, encounter, a.id, r.affinity - previous);
  // Mechanics live in the score explanations; the journal only notes what changed between them.
  if (positive && reward && eased) { if (!settleEasedConflict(s, r, encounter)) encounter.text += ' Their disagreement is easing.'; }
  // Warmth soon after a refused approach is a turning point in their story.
  if (positive && reward && r.lastRefusedMinute !== undefined && s.minute - r.lastRefusedMinute <= TURNAROUND_MINUTES) {
    encounter.highlight ??= 'turnaround'; r.lastRefusedMinute = undefined;
  }
  recordCommunityChange(s, beforeCommunity, `${positive ? 'Warm encounter' : 'Disagreement'}: ${a.name} and ${b.name}`, encounter.id);
  recordResidentChange(a, beforeA, s.minute, `${positive ? 'Warm encounter' : 'Disagreement'} with ${b.name}`, encounter.id);
  recordResidentChange(b, beforeB, s.minute, `${positive ? 'Warm encounter' : 'Disagreement'} with ${a.name}`, encounter.id);
  if (previous < 35 && r.affinity >= 35) { const t = `${a.name} and ${b.name} are becoming real friends.`; const friendship = log(s, 'friendship', t, [a.id, b.id]); friendship.highlight = 'friendship'; recordFriendship(r, s.minute); rememberEvent(a, friendship, `I’m becoming friends with ${b.name}.`, { tone: 'warm', salience: 5 }); rememberEvent(b, friendship, `I’m becoming friends with ${a.name}.`, { tone: 'warm', salience: 5 }); }
}
export const TEA_MOOD = 15, TEA_AFFINITY = -25;
/** Residents in good enough spirits who have at least one housemate they can sit with. */
export function teaGuests(s: WorldState, people: Character[]) {
  return people.filter(c => c.mood >= TEA_MOOD && people.some(o => o.id !== c.id && relationship(s, c.id, o.id).affinity >= TEA_AFFINITY));
}
export const floorSpan = (template: WorldTemplate, floor: number) => template.floors[floor]?.span ?? [8, 84] as const;
/** One draw, weighted by each floor's `draw`; equal weights match the original uniform pick. */
export function chooseFloor(template: WorldTemplate, draw: number) {
  const weights = template.floors.map(f => f.draw ?? 1);
  let remaining = draw * weights.reduce((sum, w) => sum + w, 0);
  const index = weights.findIndex(w => (remaining -= w) < 0);
  return index < 0 ? weights.length - 1 : index;
}
export function step(s: WorldState) {
  s.minute += MINUTES_PER_TICK;
  advanceConversations(s);
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
  const trust = bestTrust(s.relationships);
  for (const c of people) {
    if ((c.speechUntil ?? 0) < s.minute) { c.speech = undefined; c.speechConversationId = undefined; }
    Object.assign(c, residentDrift(c, s, trust).next);
    if (isConversing(s, c.id)) continue;
    if (c.inElevator) {
      c.floor = s.elevatorFloor;
      c.activity = 'riding the elevator';
      if (s.elevatorPhase === 'stopped' && c.floor === c.destination) { c.inElevator = false; c.x = floorSpan(template, c.floor)[1]; c.activity = 'stepping out of the elevator'; }
    } else if (c.destination !== c.floor) {
      c.x = Math.min(94, c.x + 15); c.activity = 'waiting for the elevator';
      if (s.elevatorPhase === 'stopped' && c.x >= 90 && s.elevatorFloor === c.floor) { c.inElevator = true; c.activity = 'riding the elevator'; }
    } else if (random(s) < .12) {
      c.destination = night ? template.nightFloor ?? 1 : c.energy < 20 ? 1 : chooseFloor(template, random(s));
      c.activity = c.destination === c.floor ? template.floors[c.floor].purpose : 'heading to the elevator';
    } else { const [low, high] = floorSpan(template, c.floor); c.x = clamp(c.x + (random(s) - .5) * 18, low, high); if (!c.speech) c.activity = night ? 'resting' : (template.floors[c.floor].activity ?? ['making tea', 'reading', 'tending the plants'][c.floor]); }
  }
  separateStandingResidents(s);
  advanceGestures(s, () => random(s));
  advanceQuietCompanionship(s);
  if (people.length > 1 && random(s) < .48) {
    const a = pick(s, people); const nearby = people.filter(b => !isConversing(s, a.id) && !isConversing(s, b.id) && b.id !== a.id && !b.inElevator && !a.inElevator && b.floor === a.floor && b.destination === b.floor && a.destination === a.floor && inConversationRange(a, b) && a.energy >= 10 && b.energy >= 10);
    if (nearby.length) {
      const weights = nearby.map(b => contactWillingness(relationship(s, a.id, b.id), s.minute));
      let draw = random(s) * weights.reduce((sum, weight) => sum + weight, 0);
      const b = nearby[weights.findIndex(weight => (draw -= weight) < 0)] ?? nearby[nearby.length - 1];
      if (random(s) < contactWillingness(relationship(s, a.id, b.id), s.minute)) interact(s, a, b);
      else a.activity = `giving ${b.name} space`;
    }
  }
  Object.assign(s, communityDrift(s).next);
  if (s.minute % 120 === 0) {
    for (const r of Object.values(s.relationships)) {
      if (s.minute - r.lastMinute > 720) { r.affinity *= .985; r.trust = clamp(r.trust - .2); if (r.goodwill) { r.goodwill = Math.max(0, r.goodwill - GOODWILL_DECAY_PER_DAY / 12); if (!isEased(r)) r.easedMinute = undefined; } }
    }
  }
  const day = Math.floor(s.minute / 1440);
  if (s.minute % 1440 >= 1080 && s.lastRitualDay < day && people.length >= 2) {
    s.lastRitualDay = day;
    const beforeCommunity = communityStats(s);
    const guests = teaGuests(s, people);
    if (guests.length >= 2) {
      // Tea happens whenever two willing residents come; a fuller table does more for the house.
      const share = guests.length / people.length;
      const ritual = log(s, 'ritual', share === 1 ? 'As evening settles, the house gathers for tea. An ordinary habit becomes a little tradition.'
        : `As evening settles, ${guests.map(c => c.name).join(', ')} share a pot of tea. Others keep to their own corners, but the habit holds.`, guests.map(c => c.id));
      s.cohesion = clamp(s.cohesion + 1 + 2 * share); s.resources = clamp(s.resources + 8 * share); s.tension = clamp(s.tension - 1);
      for (const c of guests) {
        const before = residentStats(c); c.belonging = clamp(c.belonging + 2);
        recordResidentChange(c, before, s.minute, 'Evening tea', ritual.id);
        rememberEvent(c, ritual, 'I joined the house for evening tea.', { tone: 'warm', salience: 2 });
      }
      recordCommunityChange(s, beforeCommunity, 'Evening tea', ritual.id);
    } else {
      const quiet = log(s, 'ritual', 'Evening comes, but the common table stays quiet. Everyone keeps to their own corner.');
      s.tension = clamp(s.tension + 2);
      recordCommunityChange(s, beforeCommunity, 'An unshared evening', quiet.id);
    }
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
    case 'house-details': updateHouseDetails(s, command); break;
    case 'add-character': createCharacter(s, command.name, command.trait, command.backstory); break;
    case 'rename-character': renameResident(s, command.characterId, command.name); return;
    case 'set-model': {
      const c = s.characters.find(c => c.id === command.characterId);
      if (!c) throw new Error('That character could not be found.');
      c.model = command.model;
      // Already revealed turns remain historical; discard pending text from the old model.
      for (const entry of s.history) if (entry.characters.includes(c.id) && entry.conversation?.status === 'active') delete entry.conversation.planned;
      break;
    }
    case 'set-appearance': {
      const c = s.characters.find(c => c.id === command.characterId);
      if (!c) throw new Error('That character could not be found.');
      const { color, appearance } = validateAppearance(command);
      c.color = color; c.appearance = appearance; break;
    }
    case 'set-away': {
      const c = s.characters.find(c => c.id === command.characterId);
      if (!c) throw new Error('That character could not be found.');
      if (c.away === command.away) return;
      if (!command.away && activeCharacters(s).length >= s.settings.populationCap) throw new Error('The house is full. Make some room before welcoming them back.');
      if (command.away) interruptConversations(s, c.id);
      c.away = command.away; c.inElevator = false; c.destination = c.floor; c.x = Math.min(c.x, 84); c.speech = undefined; c.speechConversationId = undefined; c.activity = c.away ? 'away for a while' : 'finding their feet again';
      const departure = log(s, c.away ? 'departure' : 'arrival', `${c.name} ${c.away ? 'leaves for a while. Their place in the story remains.' : 'returns to the house. There is a familiar face at the door.'}`, [c.id]);
      rememberEvent(c, departure, c.away ? 'I took some time away from the house.' : 'I came back to the house.', { salience: 5 }); break;
    }
    case 'trigger-event': {
      const event = EVENTS.find(e => e.id === command.eventId);
      if (!event) throw new Error('Unknown event.');
      if ((s.cooldowns.events ?? 0) > now) throw new Error('Let this moment settle before introducing another event.');
      s.cooldowns.events = now + EVENT_COOLDOWN_MS;
      const beforeCommunity = communityStats(s);
      s.cohesion = clamp(s.cohesion + event.cohesion); s.tension = clamp(s.tension + event.tension); s.resources = clamp(s.resources + event.resources);
      const people = activeCharacters(s);
      const occasion = log(s, 'event', event.text, people.map(c => c.id)); occasion.eventDefinitionId = event.id;
      recordCommunityChange(s, beforeCommunity, event.name, occasion.id);
      const destination = event.floor ?? (event.tone === 'kind' ? 0 : undefined);
      for (const c of people) {
        const before = residentStats(c); c.mood = clamp(c.mood + event.mood); c.energy = clamp(c.energy + (event.energy ?? 0));
        recordResidentChange(c, before, s.minute, event.name, occasion.id); if (destination !== undefined) c.destination = destination;
      }
      // Material relief is felt in mood and calm; trust moves only when people actually share a moment.
      if (event.relational === 'relief') s.reliefUntil = s.minute + RELIEF_MINUTES;
      if (event.relational === 'gathering' || event.relational === 'strain') for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
        const r = relationship(s, people[i].id, people[j].id); const previous = r.affinity;
        const open = !r.unresolvedConflict && r.affinity >= -20;
        const [affinity, trust] = event.relational === 'strain' ? [-2, -2] : open ? [3, 1] : [1, 0];
        r.affinity = clamp(r.affinity + affinity, -100, 100); recordSharedEvent(r, event.name, r.affinity - previous, occasion); r.trust = clamp(r.trust + trust);
      }
      // Chore partners: only the matched pairs work side by side, so the gain is concentrated where it is rarest.
      const partners = event.relational === 'pairing' ? choosePartners(people, (a, b) => relationship(s, a.id, b.id)) : [];
      partners.forEach(([a, b], i) => {
        const r = relationship(s, a.id, b.id); const previous = r.affinity;
        r.affinity = clamp(r.affinity + 4, -100, 100); recordSharedEvent(r, event.name, r.affinity - previous, occasion); r.trust = clamp(r.trust + 2);
        r.encounters++; r.lastMinute = s.minute;
        for (const c of [a, b]) if (!c.inElevator) c.destination = i % TEMPLATES[s.templateId].floors.length;
      });
      // Who the event singles out, and the pairs it moves in its own particular way.
      const consequences = eventConsequences(s, event, occasion, people, (a, b) => relationship(s, a.id, b.id));
      // Then each resident responds in their own way; some decide to make a peace offering.
      const { reactions, gestures } = reactToEvent(s, event, occasion, people, consequences.focus);
      // Those singled out are named by the consequences themselves, so the journal shows bystanders here.
      const shown = reactions.filter(x => x.label !== 'kept to themselves' && !consequences.focus.has(x.character.id)).slice(0, 3);
      if (shown.length) occasion.text += ` ${shown.map(x => `${x.character.name} ${x.label}`).join('; ')}.`;
      if (partners.length) occasion.text += ` ${partners.slice(0, 3).map(([a, b]) => `${a.name} and ${b.name}`).join(', ')}${partners.length > 3 ? ', among others,' : ''} pair up for the chores.`;
      for (const line of consequences.text) occasion.text += ` ${line}`;
      for (const g of gestures.slice(0, 2)) occasion.text += ` ${g.from.name} goes looking for ${g.to.name}.`;
      break;
    }
    case 'settings': {
      if (!Number.isInteger(command.populationCap) || command.populationCap < 1 || command.populationCap > 40) throw new Error('Population cap must be between 1 and 40.');
      if (!['persistent', 'fast-forward'].includes(command.mode)) throw new Error('Unknown time mode.');
      if (command.populationCap < activeCharacters(s).length) throw new Error('Send characters away before lowering the cap below the current population.');
      s.settings = { mode: command.mode, populationCap: command.populationCap }; log(s, 'world', `The world now uses ${command.mode} time, with room for ${command.populationCap} residents.`); break;
    }
    default: throw new Error('Unknown action.');
  }
  separateStandingResidents(s);
}
export function summarize(s: WorldState, protectedWorld: boolean): WorldSummary {
  return { slug: s.slug, name: s.name, description: s.description, templateId: s.templateId, createdAt: s.createdAt, population: activeCharacters(s).length, populationCap: s.settings.populationCap, mode: s.settings.mode, protected: protectedWorld, cohesion: Math.round(s.cohesion),
    residents: activeCharacters(s).map(c => ({ id: c.id, name: c.name, color: c.color, ...(c.appearance && { appearance: c.appearance }), floor: c.floor, x: Math.round(c.x * 10) / 10, ...(c.inElevator && { inElevator: true as const }) })),
    elevatorFloor: s.elevatorFloor };
}
export function gameTime(minute: number) { return `Day ${Math.floor(minute / 1440) + 1} · ${String(Math.floor(minute % 1440 / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }
