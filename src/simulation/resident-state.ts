import type { Character, ResidentStateChange, ResidentStats, WorldState } from './types';

const bound = (value: number) => Math.max(0, Math.min(100, value));
export const residentStats = (c: Character): ResidentStats => ({ mood: c.mood, energy: c.energy, belonging: c.belonging });

/** Belonging fades only down to this floor, raised by the most trusted tie a resident has. */
export function belongingFloor(c: Character, relationships: WorldState['relationships'] = {}) {
  let best = 0;
  for (const r of Object.values(relationships)) if ((r.a === c.id || r.b === c.id) && r.trust > best) best = r.trust;
  return 15 + .2 * best;
}

/** Same inputs/order as a simulation step, before movement and encounters. */
export function residentDrift(c: Character, world: Pick<WorldState, 'minute' | 'resources' | 'tension'> & Partial<Pick<WorldState, 'relationships' | 'reliefUntil'>>) {
  const night = world.minute % 1440 < 360 || world.minute % 1440 > 1320;
  const floor = belongingFloor(c, world.relationships);
  // Never pushes belonging up to the floor; it only stops the fade there.
  const fade = c.belonging > floor ? Math.min(.025, c.belonging - floor) : 0;
  const belonging = bound(c.belonging - fade);
  // A recent gift relieves supply worries for a while: the supply support doubles.
  const relieved = (world.reliefUntil ?? -Infinity) > world.minute;
  const supplies = world.resources < 20 ? -.2 : relieved ? .07 : .035;
  const connection = (belonging - 50) / 2000;
  const tension = -world.tension / 4000;
  const energy = night || c.floor === 1 ? 1.8 : -.35;
  const next = c.away ? residentStats(c) : {
    mood: bound(c.mood + supplies + connection + tension),
    energy: bound(c.energy + energy), belonging,
  };
  return { next, supplies, connection, tension, energy, night, fade, floor };
}

/** Call after a real discrete effect. Does not mutate stats, consume RNG, or infer causes. */
export function recordResidentChange(c: Character, before: ResidentStats, minute: number, cause: string, eventId: number) {
  const changes: ResidentStateChange = {
    minute, cause, eventId,
    mood: c.mood - before.mood, energy: c.energy - before.energy, belonging: c.belonging - before.belonging,
  };
  // Keep zero deltas too: an event may hit the 0–100 limit.
  c.stateChanges = [...(c.stateChanges ?? []), changes].slice(-8);
}
