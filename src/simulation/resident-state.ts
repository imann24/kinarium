import { supplyMoodEffect } from './community-dynamics';
import type { Character, ResidentStateChange, ResidentStats, WorldState } from './types';

const bound = (value: number) => Math.max(0, Math.min(100, value));
export const residentStats = (c: Character): ResidentStats => ({ mood: c.mood, energy: c.energy, belonging: c.belonging });

/** Same inputs/order as a simulation step, before movement and encounters. */
export function residentDrift(c: Character, world: Pick<WorldState, 'minute' | 'resources' | 'tension'>) {
  const night = world.minute % 1440 < 360 || world.minute % 1440 > 1320;
  const belonging = bound(c.belonging - .025);
  const supplies = supplyMoodEffect(world.resources);
  const settling = (50 - c.mood) / 250;
  const connection = (belonging - 50) / 2000;
  const tension = -world.tension / 4000;
  const energy = night || c.floor === 1 ? 1.8 : -.35;
  const next = c.away ? residentStats(c) : {
    mood: bound(c.mood + settling + supplies + connection + tension),
    energy: bound(c.energy + energy), belonging,
  };
  return { next, settling, supplies, connection, tension, energy, night };
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
