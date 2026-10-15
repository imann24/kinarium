import type { Relationship } from './types';
export type BondKind = 'close' | 'strained' | 'forming' | 'unmet';
export const bondLabels: Record<BondKind, string> = { close: 'Close connections', strained: 'Strained connections', forming: 'Other connections', unmet: 'Yet to meet' };
export function bondKind(r: Relationship): BondKind {
  if (r.encounters === 0) return 'unmet';
  if (r.unresolvedConflict || r.repairCommitment || r.trust < 25 || r.affinity < -20) return 'strained';
  return r.affinity > 35 && r.trust >= 50 ? 'close' : 'forming';
}
/** Familiarity is recorded contact, not affection or proof of reconciliation. */
export function relationshipLabel(r: Relationship) {
  if (r.encounters === 0) return 'Yet to meet';
  if (r.repairCommitment) return 'Repair in progress';
  if (r.unresolvedConflict) return 'Unresolved disagreement';
  if (r.trust < 25) return 'Low trust';
  if (r.affinity < -20) return 'Strained';
  if (r.affinity > 35 && r.trust >= 50) return 'Close';
  return r.encounters >= 10 ? 'Familiar · mixed connection' : 'Getting acquainted';
}
