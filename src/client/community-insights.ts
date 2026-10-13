import type { Character, LogEntry, Relationship, WorldState } from '../simulation/types';

export type InsightScope = 'home' | 'all';
export type BondKind = 'close' | 'strained' | 'forming' | 'unmet';
export interface InsightBond { relationship: Relationship; a: Character; b: Character; kind: BondKind; }

// Match the existing Bonds view's thresholds. These are display groups, not diagnoses.
export function bondKind(r: Relationship): BondKind {
  return r.encounters === 0 ? 'unmet' : r.affinity > 35 ? 'close' : r.affinity < -20 ? 'strained' : 'forming';
}
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Derive current-state statistics without mutating the authoritative simulation. */
export function communityInsights(world: WorldState, scope: InsightScope = 'home') {
  const residents = world.characters.filter(c => scope === 'all' || !c.away);
  const byId = new Map(residents.map(c => [c.id, c]));
  const bonds: InsightBond[] = [];
  for (const relationship of Object.values(world.relationships)) {
    const a = byId.get(relationship.a), b = byId.get(relationship.b);
    if (a && b && a.id !== b.id) bonds.push({ relationship, a, b, kind: bondKind(relationship) });
  }
  const met = bonds.filter(b => b.relationship.encounters > 0);
  const possiblePairs = residents.length * Math.max(0, residents.length - 1) / 2;
  return {
    residents, bonds, met, possiblePairs,
    notMet: possiblePairs - met.length,
    close: met.filter(b => b.kind === 'close').length,
    strained: met.filter(b => b.kind === 'strained').length,
    forming: met.filter(b => b.kind === 'forming').length,
    mood: average(residents.map(c => c.mood)),
    belonging: average(residents.map(c => c.belonging)),
    trust: average(met.map(b => b.relationship.trust)),
    encounters: met.reduce((sum, b) => sum + b.relationship.encounters, 0),
    residentDetails: residents.map(character => ({
      character,
      met: met.filter(b => b.a.id === character.id || b.b.id === character.id).length,
    })).sort((a, b) => a.character.belonging - b.character.belonging || a.character.name.localeCompare(b.character.name)),
  };
}

/** Counts retained journal records, never inferred interactions or reconstructed score history. */
export function recentActivity(world: WorldState) {
  const entries = [...new Map(world.history.filter(e => e.minute <= world.minute).map(e => [e.id, e])).values()]
    .sort((a, b) => a.id - b.id);
  const earliest = entries.length ? Math.min(...entries.map(e => e.minute)) : null;
  const buckets = Array.from({ length: 3 }, (_, index) => {
    const end = world.minute - (2 - index) * 120;
    const start = end - 120;
    // Adjacent windows are (start, end], so a boundary record appears exactly once.
    const records = entries.filter(e => e.minute > start && e.minute <= end);
    return { start, end, conversations: records.filter(e => e.kind === 'conversation').length,
      conflicts: records.filter(e => e.kind === 'conflict').length,
      partial: earliest === null || earliest > start };
  });
  return { entries, earliest, buckets, truncated: entries.length > 0 && entries[0].id > 1 };
}

export function pairRecords(entries: LogEntry[], a: string, b: string) {
  return entries.filter(e => ['conversation', 'conflict', 'friendship'].includes(e.kind) && e.characters.includes(a) && e.characters.includes(b))
    .sort((a, b) => b.id - a.id);
}
