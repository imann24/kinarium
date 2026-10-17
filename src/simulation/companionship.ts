import { nearby } from './conversations';
import { rememberEvent } from './memories';
import { recordResidentChange, residentStats } from './resident-state';
import type { Character, LogEntry, Relationship, WorldState } from './types';

export const QUIET_DURATION = 12;
export const QUIET_COOLDOWN = 240;
const bound = (n: number) => Math.max(0, Math.min(100, n));

/** Both residents must have room for company. Affinity alone is not safety/trust. */
export function quietComfort(a: Character, b: Character, r: Relationship, minute: number) {
  if (r.encounters === 0 || r.trust < 35 || r.affinity < 0 || Math.min(a.mood, b.mood) < 15) return 0;
  const openness = (c: Character) => (c.trait === 'reserved' || c.trait === 'kind' ? .1 : c.trait === 'spirited' ? -.1 : 0)
    - Math.max(0, 45 - c.mood) / 100;
  const comfort = Math.min(1, .25 + r.trust / 160 + r.affinity / 400 + Math.min(openness(a), openness(b)));
  if (comfort < .5) return 0;
  if (r.unresolvedConflict) {
    if (r.trust < 60 || minute - Math.max(r.unresolvedConflict.minute, r.lastRepairMinute ?? -Infinity) < 120) return 0;
    return comfort * .25; // A respite is possible; it is not forgiveness.
  }
  return comfort;
}

/** Sustained, unoccupied proximity, never a reward for merely sharing a floor. */
export function advanceQuietCompanionship(world: WorldState) {
  const busy = new Set(world.history.filter(e => e.conversation?.status === 'active').flatMap(e => e.characters));
  const people = new Map(world.characters.map(c => [c.id, c]));
  for (const r of Object.values(world.relationships)) {
    const a = people.get(r.a), b = people.get(r.b);
    const comfort = a && b ? quietComfort(a, b, r, world.minute) : 0;
    if (!a || !b || !comfort || !nearby(a, b) || busy.has(a.id) || busy.has(b.id)
      || world.minute - Math.max(a.lastQuietMinute ?? -Infinity, b.lastQuietMinute ?? -Infinity, r.lastQuietMinute ?? -Infinity) < QUIET_COOLDOWN) {
      r.quietSince = undefined;
      continue;
    }
    // Catch-up skips are not evidence of time actually spent together.
    if (r.quietLastMinute !== world.minute - 2 && r.quietLastMinute !== world.minute) r.quietSince = undefined;
    r.quietLastMinute = world.minute;
    r.quietSince ??= world.minute;
    if (world.minute - r.quietSince < QUIET_DURATION) continue;
    r.quietSince = undefined;
    r.lastQuietMinute = world.minute;
    r.lastConnectionMinute = world.minute;
    r.lastMinute = world.minute;
    const tense = !!r.unresolvedConflict;
    const entry: LogEntry = {
      id: world.nextLog++, minute: world.minute, kind: 'ritual', characters: [a.id, b.id],
      text: `${a.name} and ${b.name} spend a quiet while together. ${tense ? 'Familiar company offers a small respite; their disagreement and trust are unchanged.' : comfort >= .8 ? 'Trusted company restores some mood, energy and belonging; house tension eases.' : 'Comfortable company offers a little rest and belonging; house tension eases slightly.'}`,
    };
    world.history.push(entry);
    world.tension = bound(world.tension - .6 * comfort);
    for (const [c, other] of [[a, b], [b, a]]) {
      const before = residentStats(c);
      c.mood = bound(c.mood + 3 * comfort);
      c.energy = bound(c.energy + 4 * comfort);
      c.belonging = bound(c.belonging + 2 * comfort);
      c.lastQuietMinute = world.minute;
      c.activity = `resting quietly with ${other.name}`;
      recordResidentChange(c, before, world.minute, `Quiet company with ${other.name}`, entry.id);
      rememberEvent(c, entry, `I spent a quiet while with ${other.name}. ${tense ? 'I found a little rest, but our disagreement is still unresolved.' : 'I felt more rested and included without needing to talk.'}`, { tone: tense ? 'neutral' : 'warm', salience: 2 });
    }
    // A resident cannot collect rewards from every nearby partner in the same tick.
    busy.add(a.id); busy.add(b.id);
  }
}
