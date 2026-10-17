import type { WorldState } from './types';

export type CommunityMetric = 'cohesion' | 'tension' | 'resources';
export type CommunityStats = Pick<WorldState, CommunityMetric>;
export interface CommunityChange extends CommunityStats { minute: number; cause: string; eventId: number; }
const bound = (n: number) => Math.max(0, Math.min(100, n));
export const communityStats = (w: WorldState): CommunityStats => ({ cohesion: w.cohesion, tension: w.tension, resources: w.resources });

/** Same end-of-step calculation for simulation and explanation. Positions may change next step. */
export function communityDrift(w: WorldState) {
  const people = w.characters.filter(c => !c.away);
  const producers = people.filter(c => c.floor === 2 && c.trait === 'practical').length;
  const consumption = people.length * .008, production = producers * .12;
  const resources = bound(w.resources - consumption + production);
  const scarcity = resources < 20;
  return { population: people.length, producers, consumption, production, scarcity,
    next: { resources, cohesion: bound(w.cohesion - (scarcity ? .04 : 0)), tension: bound(w.tension + (scarcity ? .06 : 0)) } };
}

/** Actual, bounded discrete changes only. Never reconstruct causes from old journal prose. */
export function recordCommunityChange(w: WorldState, before: CommunityStats, cause: string, eventId: number) {
  const change = { minute: w.minute, cause, eventId, cohesion: w.cohesion - before.cohesion, tension: w.tension - before.tension, resources: w.resources - before.resources };
  if (!change.cohesion && !change.tension && !change.resources) return;
  w.communityChanges = [...(w.communityChanges ?? []), change].slice(-40);
}
