import type { WorldState } from '../simulation/types';

export const ELEVATOR_TRAVEL_MS = 2_800;
export const ELEVATOR_PAUSE_MS = 350;
const WALK_MS = 3_600;
const DOORWAY_MS = 700;
const CABIN_X = 757;
type Point = { x: number; floor: number; aboard: boolean };
type Ride = { from: Point; to: Point; start: number; end: number; exitAt?: number };
export interface BuildingMotion {
  slug: string;
  minute: number;
  cabin: { from: number; to: number; start: number; end: number };
  residents: Record<string, Ride>;
}
const progress = (now: number, start: number, end: number) => end <= start ? 1 : Math.max(0, Math.min(1, (now - start) / (end - start)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
export function cabinFloor(motion: BuildingMotion, now: number) {
  const c = motion.cabin;
  return mix(c.from, c.to, ease(progress(now, c.start, c.end)));
}
export function residentPosition(motion: BuildingMotion, id: string, now: number): Point {
  const r = motion.residents[id];
  if (r.exitAt !== undefined && now < r.exitAt) return { x: CABIN_X, floor: cabinFloor(motion, now), aboard: true };
  const t = progress(now, r.start, r.end);
  return {
    x: mix(r.from.x, r.to.x, t),
    floor: r.to.aboard ? cabinFloor(motion, now) : mix(r.from.floor, r.to.floor, t),
    aboard: r.to.aboard,
  };
}
export function motionEndsAt(motion: BuildingMotion) {
  return Math.max(motion.cabin.end, ...Object.values(motion.residents).map(r => r.end));
}

// Presentation only: all riders sample the same cabin curve and clock. Repeated
// presence/AI snapshots preserve running tracks instead of restarting animations.
export function planBuildingMotion(previous: BuildingMotion | undefined, world: WorldState, now: number, immediate = false): BuildingMotion {
  const snap = immediate || !previous || previous.slug !== world.slug || world.minute < previous.minute || world.minute - previous.minute > 4;
  const prior = snap ? undefined : previous;
  const moved = prior && prior.cabin.to !== world.elevatorFloor;
  const cabin = !prior ? { from: world.elevatorFloor, to: world.elevatorFloor, start: now, end: now }
    : moved ? { from: cabinFloor(prior, now), to: world.elevatorFloor, start: now, end: now + ELEVATOR_TRAVEL_MS }
    : prior.cabin;
  const motion: BuildingMotion = { slug: world.slug, minute: world.minute, cabin, residents: {} };
  for (const c of world.characters.filter(c => !c.away)) {
    const to: Point = { x: c.inElevator ? CABIN_X : 135 + c.x * 5.85, floor: c.floor, aboard: !!c.inElevator };
    const old = prior?.residents[c.id];
    if (old && old.to.x === to.x && old.to.floor === to.floor && old.to.aboard === to.aboard) {
      motion.residents[c.id] = old; continue;
    }
    const from = old ? residentPosition(prior!, c.id, now) : to;
    if (!prior || !old || (from.aboard && !to.aboard && c.floor !== cabin.to)) {
      // Initial loads and missed trips reconcile at the current landing; never
      // invent a diagonal journey out of a cabin that has already passed it.
      motion.residents[c.id] = { from: to, to, start: now, end: now }; continue;
    }
    if (from.aboard && !to.aboard) {
      const exitAt = Math.max(now, cabin.end + ELEVATOR_PAUSE_MS);
      motion.residents[c.id] = { from: { x: CABIN_X, floor: to.floor, aboard: true }, to, start: exitAt, end: exitAt + DOORWAY_MS, exitAt };
    } else {
      motion.residents[c.id] = { from, to, start: now, end: now + (to.aboard ? DOORWAY_MS : WALK_MS) };
    }
  }
  return motion;
}
