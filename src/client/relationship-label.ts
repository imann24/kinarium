import { isEased } from '../simulation/goodwill';
import type { Relationship } from '../simulation/types';

export const bondLabels = {
  close: 'Close',
  warm: 'Fond but cautious',
  trusted: 'Trusted, not close',
  familiar: 'Familiar but distant',
  repairing: 'Repair promised',
  easing: 'Easing',
  strained: 'Strained',
  forming: 'Getting acquainted',
  unmet: 'Yet to meet',
} as const;
export type BondKind = keyof typeof bondLabels;

/** Display categories only: familiarity is not friendship, and scores are not a trend. */
export function bondKind(r: Relationship): BondKind {
  if (r.encounters === 0) return 'unmet';
  if (r.unresolvedConflict) {
    if (r.repairCommitment?.conflictId === r.unresolvedConflict.id
      && r.repairedConflictId !== r.unresolvedConflict.id) return 'repairing';
    // Honored choices have built enough goodwill that the disagreement is easing.
    return isEased(r) ? 'easing' : 'strained';
  }
  if (r.affinity < -20) return 'strained';
  if (r.affinity > 35) return r.trust > 55 ? 'close' : 'warm';
  if (r.trust > 55) return 'trusted';
  // Ten conversations establish familiarity, not closeness. A recorded friendship
  // also rules out a new acquaintance, even if only a few encounters were saved.
  if (r.encounters >= 10 || r.story?.friendsMinute !== undefined) return 'familiar';
  return 'forming';
}

export const relationshipLabel = (r: Relationship) => bondLabels[bondKind(r)];
