import type { WorldState } from './types';

export type CommunityMetric = 'cohesion' | 'tension' | 'resources';
export type CommunityStats = Pick<WorldState, CommunityMetric>;
export interface CommunityChange extends CommunityStats { minute: number; cause: string; eventId: number; }
const bound = (n: number) => Math.max(0, Math.min(100, n));
export const communityStats = (w: WorldState): CommunityStats => ({ cohesion: w.cohesion, tension: w.tension, resources: w.resources });

/** A house settles only after this long without a fresh disagreement. */
export const CALM_MINUTES = 180;
/** Calm eases tension down to, and restores togetherness up to, these levels; no further. */
export const CALM_TENSION_FLOOR = 20, CALM_COHESION_FLOOR = 35;
export const CALM_TENSION_EASE = .05, CALM_COHESION_GAIN = .02;
/** Even a quarrelling house cools a little with time, as long as supplies hold. */
export const COOLING_TENSION_EASE = .02, COOLING_COHESION_GAIN = .005;

/** Whether any disagreement began within the calm window. Scans only recent history. */
function recentConflict(w: WorldState) {
  for (let i = w.history.length - 1; i >= 0; i--) {
    const e = w.history[i];
    if (w.minute - e.minute >= CALM_MINUTES) return false;
    if (e.kind === 'conflict') return true;
  }
  return false;
}

/** Same end-of-step calculation for simulation and explanation. Positions may change next step. */
export function communityDrift(w: WorldState) {
  const people = w.characters.filter(c => !c.away);
  const producers = people.filter(c => c.floor === 2 && c.trait === 'practical').length;
  const consumption = people.length * .008, production = producers * .12;
  const resources = bound(w.resources - consumption + production);
  const scarcity = resources < 20;
  // A calm, supplied house slowly settles; ongoing quarrels or scarcity prevent it.
  const calm = !scarcity && !recentConflict(w);
  const ease = scarcity ? 0 : calm ? CALM_TENSION_EASE : COOLING_TENSION_EASE;
  const gain = scarcity ? 0 : calm ? CALM_COHESION_GAIN : COOLING_COHESION_GAIN;
  const settling = w.tension > CALM_TENSION_FLOOR ? Math.min(ease, w.tension - CALM_TENSION_FLOOR) : 0;
  const gathering = w.cohesion < CALM_COHESION_FLOOR ? Math.min(gain, CALM_COHESION_FLOOR - w.cohesion) : 0;
  return { population: people.length, producers, consumption, production, scarcity, calm, settling, gathering,
    next: { resources, cohesion: bound(w.cohesion - (scarcity ? .04 : 0) + gathering), tension: bound(w.tension + (scarcity ? .06 : 0) - settling) } };
}

/** Actual, bounded discrete changes only. Never reconstruct causes from old journal prose. */
export function recordCommunityChange(w: WorldState, before: CommunityStats, cause: string, eventId: number) {
  const change = { minute: w.minute, cause, eventId, cohesion: w.cohesion - before.cohesion, tension: w.tension - before.tension, resources: w.resources - before.resources };
  if (!change.cohesion && !change.tension && !change.resources) return;
  w.communityChanges = [...(w.communityChanges ?? []), change].slice(-40);
}
