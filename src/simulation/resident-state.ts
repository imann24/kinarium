import type { Character, ResidentStateChange, ResidentStats, WorldState } from './types';

const bound = (value: number) => Math.max(0, Math.min(100, value));
export const residentStats = (c: Character): ResidentStats => ({ mood: c.mood, energy: c.energy, belonging: c.belonging });

/** Each resident's highest trust in anyone. A step computes this once for everyone. */
export function bestTrust(relationships: WorldState['relationships'] = {}) {
  const best = new Map<string, number>();
  for (const r of Object.values(relationships)) for (const id of [r.a, r.b]) if (r.trust > (best.get(id) ?? 0)) best.set(id, r.trust);
  return best;
}
/** Belonging fades only down to this floor, raised by the most trusted tie a resident has. */
export const belongingFloor = (c: Character, best: Map<string, number>) => 15 + .2 * (best.get(c.id) ?? 0);

/** Same inputs/order as a simulation step, before movement and encounters. */
export function residentDrift(c: Character, world: Pick<WorldState, 'minute' | 'resources' | 'tension'> & Partial<Pick<WorldState, 'relationships' | 'reliefUntil'>>, trust = bestTrust(world.relationships)) {
  const night = world.minute % 1440 < 360 || world.minute % 1440 > 1320;
  const floor = belongingFloor(c, trust);
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
