import { TEMPLATES, type EventDefinition } from './catalog';
import type { Reaction } from './event-reactions';
import { addGoodwill, flareConflict, startConflict } from './goodwill';
import { recordSharedEvent } from './relationship-story';
import { recordResidentChange, residentStats } from './resident-state';
import type { Character, LogEntry, Relationship, WorldState } from './types';

/** Below this energy, a lean week is felt as more than an empty cupboard. */
export const WORN_DOWN_ENERGY = 35;
/** After a sleepless night, two residents this tired snap at each other. */
export const SNAPPISH_ENERGY = 25;
/** Close enough that a resident looks after someone who falls ill whatever their temperament. */
export const CARING_AFFINITY = 20;

const bound = (n: number, low = 0) => Math.max(low, Math.min(100, n));
const names = (people: Character[]) => people.length < 2 ? people[0]?.name ?? '' : `${people.slice(0, -1).map(c => c.name).join(', ')} and ${people.at(-1)!.name}`;
function hash(key: string) {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** Least at home first; the people order breaks ties so the choice is deterministic. */
const leastAtHome = (people: Character[]) => [...people].sort((a, b) => a.belonging - b.belonging);

export interface Consequences {
  /** Sentences added to the journal entry, after residents' reactions. */
  text: string[];
  /** Residents the event singled out, with their own experience of it. */
  focus: Map<string, Reaction>;
}

/**
 * What an event does beyond its house-wide numbers: who it singles out and which pairs it moves.
 * Each relational kind touches the house in its own way, so no two events play out alike.
 */
export function eventConsequences(world: WorldState, event: EventDefinition, occasion: LogEntry, people: Character[], pair: (a: Character, b: Character) => Relationship): Consequences {
  const text: string[] = [], focus = new Map<string, Reaction>();
  const pairs = people.flatMap((a, i) => people.slice(i + 1).map(b => ({ a, b, r: pair(a, b) })));
  const shift = (r: Relationship, affinity: number, trust: number) => {
    const previous = r.affinity;
    r.affinity = bound(r.affinity + affinity, -100); r.trust = bound(r.trust + trust);
    recordSharedEvent(r, event.name, r.affinity - previous, occasion);
  };
  const flare = (r: Relationship) => { r.lastQuarrelMinute = world.minute; flareConflict(r); };
  const openConflict = (r: Relationship) => {
    if (r.unresolvedConflict) return flare(r);
    r.lastQuarrelMinute = world.minute;
    r.unresolvedConflict = { id: occasion.id, minute: world.minute, topic: event.conflictTopic ?? event.name };
    r.repairCommitment = undefined; startConflict(r, world.minute);
  };
  const feel = (c: Character, cause: string, change: { mood?: number; energy?: number; belonging?: number }) => {
    const before = residentStats(c);
    c.mood = bound(c.mood + (change.mood ?? 0)); c.energy = bound(c.energy + (change.energy ?? 0)); c.belonging = bound(c.belonging + (change.belonging ?? 0));
    recordResidentChange(c, before, world.minute, `${event.name}: ${cause}`, occasion.id);
  };
  const floors = TEMPLATES[world.templateId].floors.length;
  const send = (c: Character, floor: number) => { if (!c.inElevator) c.destination = floor; };

  switch (event.relational) {
    case 'crowding': {
      // Close quarters: friends weather it, strangers chafe, and open disagreements flare.
      let flared = 0;
      for (const { r } of pairs) {
        if (r.unresolvedConflict) { flare(r); shift(r, -3, -1); flared++; }
        else if (r.affinity < 15) shift(r, -2, 0);
        else shift(r, 1, 0);
      }
      if (flared) text.push('Open disagreements flare in the crowded room.');
      break;
    }
    case 'suspicion': {
      if (people.length < 2) break;
      const [suspect] = leastAtHome(people);
      focus.set(suspect.id, { label: 'felt eyes on them', memory: 'I could feel people wondering about me. I hadn’t taken anything.', mood: -6, belonging: -8 });
      for (const { a, b, r } of pairs) {
        if (a !== suspect && b !== suspect) { shift(r, 0, -1); continue; }
        const other = a === suspect ? b : a;
        // Kind residents give the benefit of the doubt, though even they grow a little careful.
        if (other.trait === 'kind') shift(r, 0, -2); else shift(r, -2, -6);
      }
      text.push(`Glances keep drifting toward ${suspect.name}.`);
      break;
    }
    case 'quarrel': {
      // The most strained pair without an open disagreement; failing that, an old one flares.
      const target = [...pairs].sort((x, y) => Number(!!x.r.unresolvedConflict) - Number(!!y.r.unresolvedConflict) || x.r.affinity + x.r.trust - (y.r.affinity + y.r.trust))[0];
      if (!target) break;
      const { a, b, r } = target;
      shift(r, -8, -4); openConflict(r);
      for (const [c, other] of [[a, b], [b, a]]) focus.set(c.id, { label: `had it out with ${other.name}`, memory: `I had it out with ${other.name}, loudly. I’m not proud of all of it.`, mood: -6, energy: -6 });
      // They storm off in different directions.
      send(b, (a.destination + 1) % floors);
      text.push(`${a.name} and ${b.name} have it out in the hallway.`);
      break;
    }
    case 'scarcity': {
      // Hunger is hardest on whoever had nothing left to spare; the comfort of a recent gift is gone too.
      world.reliefUntil = undefined;
      const worn = people.filter(c => c.energy < WORN_DOWN_ENERGY);
      for (const c of worn) feel(c, 'running on empty', { mood: -4 });
      if (worn.length) text.push(`${names(worn.slice(0, 3))}${worn.length > 3 ? ', among others,' : ''} ${worn.length === 1 ? 'feels' : 'feel'} it most.`);
      break;
    }
    case 'sleepless': {
      const snapped = pairs.filter(({ a, b }) => a.energy < SNAPPISH_ENERGY && b.energy < SNAPPISH_ENERGY);
      for (const { r } of snapped) { if (r.unresolvedConflict) flare(r); shift(r, -2, -1); }
      if (snapped.length) text.push(`By morning, ${snapped[0].a.name} and ${snapped[0].b.name} are snapping at each other.`);
      break;
    }
    case 'betrayal': {
      // It hurts most where trust was highest; everyone else gets a little more guarded.
      const target = pairs.filter(p => !p.r.unresolvedConflict).sort((x, y) => y.r.trust - x.r.trust)[0];
      if (!target) break;
      const { a: teller, b: told, r } = target;
      for (const other of pairs) if (other !== target) shift(other.r, 0, -1);
      shift(r, -6, -12); openConflict(r);
      focus.set(teller.id, { label: `passed on what ${told.name} told them`, memory: `I passed on something ${told.name} told me in confidence. I didn’t think it would travel.`, mood: -4, belonging: -3 });
      focus.set(told.id, { label: 'learned their secret had travelled', memory: `Something I told ${teller.name} in confidence came back to me from someone else.`, mood: -8, belonging: -2 });
      text.push(`${teller.name} let slip something ${told.name} had told them in confidence.`);
      break;
    }
    case 'exclusion': {
      if (people.length < 3) break;
      const outsiders = leastAtHome(people).slice(0, people.length >= 6 ? 2 : 1);
      const noticed: Character[] = [];
      for (const x of outsiders) focus.set(x.id, { label: 'found out about the plans afterwards', memory: 'I found out about the plans afterwards. Nobody had thought to ask me.', mood: -6, belonging: -10 });
      for (const { a, b, r } of pairs) {
        const outsider = outsiders.find(x => x === a || x === b), other = outsider === a ? b : a;
        if (!outsider || outsiders.includes(other)) continue;
        // Kind residents notice who is missing and go to find them.
        if (other.trait === 'kind') { shift(r, 3, 1); send(other, outsider.floor); if (!noticed.includes(other)) noticed.push(other); }
        else shift(r, -2, 0);
      }
      text.push(`${names(outsiders)} ${outsiders.length === 1 ? 'is' : 'are'} left off the list.`);
      if (noticed.length) text.push(`${names(noticed.slice(0, 2))} ${noticed.length === 1 ? 'notices' : 'notice'}.`);
      break;
    }
    case 'letdown': {
      // A peace offering planned for a good moment waits for another one.
      const here = new Set(people.map(c => c.id));
      const postponed = (world.pendingGestures ?? []).filter(g => here.has(g.fromId));
      world.pendingGestures = world.pendingGestures?.filter(g => !postponed.includes(g));
      if (!world.pendingGestures?.length) world.pendingGestures = undefined;
      const first = postponed[0] && [people.find(c => c.id === postponed[0].fromId)!, world.characters.find(c => c.id === postponed[0].toId)!];
      if (first?.[1]) text.push(`${first[0].name} puts off going to find ${first[1].name}.`);
      break;
    }
    case 'faction': {
      if (people.length < 2) break;
      const shuffled = [...people].sort((a, b) => hash(`${world.seed}:${occasion.id}:${a.id}`) - hash(`${world.seed}:${occasion.id}:${b.id}`));
      const ayes = shuffled.filter((_, i) => i % 2 === 0), noes = shuffled.filter((_, i) => i % 2 === 1);
      for (const { a, b, r } of pairs) {
        if (ayes.includes(a) === ayes.includes(b)) shift(r, 2, 1);
        else { if (r.unresolvedConflict) flare(r); shift(r, -3, 0); }
      }
      for (const c of ayes) feel(c, 'won the vote', { mood: 3 });
      for (const c of noes) feel(c, 'lost the vote', { mood: -3 });
      text.push(people.length <= 6 ? `The motion carries: ${names(ayes)} for, ${names(noes)} against.` : `The motion carries by ${ayes.length} votes to ${noes.length}.`);
      break;
    }
    case 'hardship': {
      // A shared worry draws everyone a little closer and makes old grudges feel smaller.
      let softened = 0;
      for (const { r } of pairs) { shift(r, 1, 1); if (r.unresolvedConflict) { addGoodwill(r, .5, world.minute); softened++; } }
      if (softened) text.push('Old grudges feel smaller beside the bill.');
      break;
    }
    case 'care': {
      if (!people.length) break;
      const [patient] = [...people].sort((a, b) => a.energy - b.energy || a.mood - b.mood);
      const restFloor = Math.min(1, floors - 1);
      focus.set(patient.id, { label: 'came down with a fever', memory: 'I came down with a fever and spent the day in bed. People were kinder than I expected.', mood: -6, energy: -20, floor: restFloor });
      const carers: Character[] = [];
      for (const { a, b, r } of pairs) {
        if (a !== patient && b !== patient) continue;
        const other = a === patient ? b : a;
        if (other.trait !== 'kind' && other.trait !== 'practical' && r.affinity < CARING_AFFINITY) continue;
        // Looking after someone you are at odds with is good faith shown, not said.
        shift(r, 4, 3); if (r.unresolvedConflict) addGoodwill(r, 1.5, world.minute);
        send(other, restFloor); carers.push(other);
      }
      text.push(`${patient.name} is the one in bed${carers.length ? `; ${names(carers.slice(0, 3))} ${carers.length === 1 ? 'looks' : 'look'} after them` : ''}.`);
      break;
    }
    case 'honor': {
      if (!people.length) break;
      const [honoree] = leastAtHome(people);
      focus.set(honoree.id, { label: 'was surprised with a cake', memory: 'The house surprised me with a cake. I didn’t know anyone had remembered.', mood: 8, belonging: 12 });
      for (const { a, b, r } of pairs) if (a === honoree || b === honoree) { shift(r, 3, 1); if (r.unresolvedConflict) addGoodwill(r, 1, world.minute); }
      text.push(`The cake is for ${honoree.name}.`);
      break;
    }
  }
  return { text, focus };
}
