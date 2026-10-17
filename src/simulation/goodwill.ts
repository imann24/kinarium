import { communityStats, recordCommunityChange } from './community-state';
import { relationshipStory } from './relationship-story';
import { recordResidentChange, residentStats } from './resident-state';
import type { LogEntry, Relationship, WorldState } from './types';

export const GOODWILL_MAX = 10;
/** Goodwill at which an open disagreement starts to ease. */
export const EASED_GOODWILL = 3;
/** An eased disagreement settles only after this long, then a good moment together. */
export const SETTLE_DELAY = 720;
/** Lost per simulated day without contact. */
export const GOODWILL_DECAY_PER_DAY = .25;
const bound = (n: number) => Math.max(0, Math.min(100, n));

export const goodwill = (r: Relationship) => r.goodwill ?? 0;
export const isEased = (r: Relationship) => !!r.unresolvedConflict && goodwill(r) >= EASED_GOODWILL;

/** Honored choices accumulate; a disagreement eases once enough good faith is shown. */
export function addGoodwill(r: Relationship, amount: number, minute: number) {
  r.goodwill = Math.max(0, Math.min(GOODWILL_MAX, goodwill(r) + amount));
  if (isEased(r)) r.easedMinute ??= minute;
  else r.easedMinute = undefined;
}

/** A fresh disagreement costs some goodwill and restarts the wait before it can settle. */
export function startConflict(r: Relationship, minute: number) {
  r.goodwill = Math.max(0, goodwill(r) - 1);
  r.easedMinute = isEased(r) ? minute : undefined;
}

/** Quarrelling again over an open disagreement wears away some goodwill, but keeps the repair under way. */
export function flareConflict(r: Relationship) {
  r.goodwill = Math.max(0, goodwill(r) - .5);
  if (!isEased(r)) r.easedMinute = undefined;
}

/** Refusals on the current conflict; earlier conflicts' refusals do not carry over. */
export function repairRefusals(r: Relationship, conflictId: number) {
  return r.repairRefusals?.conflictId === conflictId ? r.repairRefusals.count : 0;
}

/**
 * Good faith plus time plus a good moment together settles an eased disagreement,
 * without needing an accepted follow-through. Returns whether it settled.
 */
export function settleEasedConflict(world: WorldState, r: Relationship, entry: LogEntry) {
  const conflict = r.unresolvedConflict;
  if (!conflict || !isEased(r) || r.easedMinute === undefined || world.minute - r.easedMinute < SETTLE_DELAY) return false;
  r.repairedConflictId = conflict.id;
  r.unresolvedConflict = undefined; r.repairCommitment = undefined; r.easedMinute = undefined; r.repairRefusals = undefined;
  for (const t of relationshipStory(r).disagreements) if (t.topic === conflict.topic) t.mendedMinute = world.minute;
  const beforeCommunity = communityStats(world);
  world.tension = bound(world.tension - 1.5);
  world.cohesion = bound(world.cohesion + 1);
  for (const id of [r.a, r.b]) {
    const c = world.characters.find(person => person.id === id);
    if (!c) continue;
    const before = residentStats(c);
    c.mood = bound(c.mood + 2); c.belonging = bound(c.belonging + 2);
    recordResidentChange(c, before, world.minute, 'Disagreement settled through goodwill', entry.id);
  }
  recordCommunityChange(world, beforeCommunity, 'Disagreement settled through goodwill', entry.id);
  entry.text += ` Their disagreement about ${conflict.topic.toLowerCase()} has settled; honored choices and time did what one conversation could not.`;
  return true;
}
