import { TEMPLATES } from '../simulation/catalog';
import { communityDrift, type CommunityMetric } from '../simulation/community-state';
import type { WorldState } from '../simulation/types';

export const signedMetric = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(3).replace(/\.?0+$/, '') || '0'}`;
export function communityMetricDetails(w: WorldState, metric: CommunityMetric) {
  const drift = communityDrift(w);
  const current = metric === 'resources' ? [
    `${drift.population} residents at home use ${signedMetric(-drift.consumption)} points per step (0.008 each).`,
    `${drift.producers} practical residents on ${TEMPLATES[w.templateId].floors[2].name} add ${signedMetric(drift.production)} per step (0.12 each).`,
    `Net change at current positions, after the 0–100 limits: ${signedMetric(drift.next.resources - w.resources)} per step.`,
  ] : [
    drift.scarcity
      ? `At current positions, supplies would be below 20 after consumption and production: ${metric === 'cohesion' ? '−0.04 togetherness' : '+0.06 tension'} per step before limits.`
      : 'At current positions, supplies stay at or above 20 after consumption and production, so scarcity adds no pressure.',
    `Net ongoing change after the 0–100 limits: ${signedMetric(drift.next[metric] - w[metric])} per step. Encounters and events are separate.`,
  ];
  const meaning = {
    cohesion: 'Togetherness is a running measure of connection in the house, not an average of residents’ belonging or relationships. Warm encounters, completed repair, shared tea and introduced events can change it.',
    tension: 'Tension is a running measure of strain in the house, not a count of unresolved disagreements. Disagreements and scarcity raise it; warm encounters, accepted repair and comfortable quiet company can ease it. Introduced events and unshared evenings can also change it.',
    resources: 'Shared resources is the house’s running supply score. Residents consume supplies; practical residents on the supply floor replenish them. Shared evening tea and introduced events also change it.',
  }[metric];
  const recent = (w.communityChanges ?? []).filter(c => c.minute <= w.minute && w.minute - c.minute <= 360 && c[metric] !== 0).slice(-5).reverse();
  return { meaning, current, recent };
}
