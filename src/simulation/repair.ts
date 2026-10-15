import type { Character, LogEntry, Relationship, WorldState } from './types';

const bound = (n: number, low = 0) => Math.max(low, Math.min(100, n));
/** Even strangers have ordinary contact; distrust reduces it without making exile permanent. */
export function contactWillingness(r: Relationship) { return .12 + .88 * Math.min(1, r.trust / 50); }

export function repairScene(world: WorldState, a: Character, b: Character, r: Relationship, roll: number) {
  const historical = [...world.history].reverse().find(e => e.kind === 'conflict' && !e.conversation?.repair && e.conversation?.status === 'finished' && e.characters.includes(a.id) && e.characters.includes(b.id));
  const conflict = r.unresolvedConflict ?? (historical ? { id: historical.id, minute: historical.minute, topic: historical.conversation!.topic } : undefined);
  if (!conflict || conflict.id === r.repairedConflictId) return;
  const since = world.minute - Math.max(conflict.minute, r.lastRepairMinute ?? conflict.minute);
  if (since < 120 || a.energy < 25 || b.energy < 25) return;
  const following = r.repairCommitment?.conflictId === conflict.id;
  if (following && r.repairCommitment!.initiatorId !== a.id) return;
  // Mood, temperament, time and past follow-through affect readiness; refusal remains possible.
  const readiness = Math.max(.15, Math.min(.8, .3 + r.trust / 200 + b.mood / 300 + (b.trait === 'kind' ? .12 : b.trait === 'reserved' ? -.08 : 0) - world.tension / 300));
  const accepted = roll < readiness;
  const topic = conflict.topic;
  const lines = following ? [
    `After our disagreement about ${topic.toLowerCase()}, I said I would ask first. Would you like to choose where we sit, or would you prefer space?`,
    accepted ? 'I’ll choose a place to sit. Please let me finish explaining before you answer.' : 'Space, please. I’m not ready to sit together.',
    accepted ? 'Go ahead. I’ll wait and listen.' : 'All right. I’ll leave you room and won’t press for an answer.',
    accepted ? 'Thank you for waiting. Being able to make that choice helps, even though I’m still cautious.' : 'Thank you for accepting that. I still need time.',
  ] : [
    `I’ve been thinking about our disagreement about ${topic.toLowerCase()}. Could I listen to what is still bothering you?`,
    accepted ? 'I want room to disagree without having to defend it immediately. Can you give me that?' : 'Not yet. I don’t want to go through it again right now.',
    accepted ? 'Yes. Next time we share a space, I’ll ask what you want before making a choice for us.' : 'I hear you. I’ll give you space before asking again.',
    accepted ? 'I’m willing to see how that goes. A promise alone doesn’t settle this.' : 'That is what I need right now. This is still unresolved.',
  ];
  return { eventText: undefined, id: following ? 'repair:follow-through' : 'repair:offer', topic: following ? 'Following through after disagreement' : 'An attempt to repair', lines, relevance: 100,
    repair: { conflictId: conflict.id, phase: following ? 'follow-through' as const : 'offer' as const, accepted } };
}

/** Consequences require the action AND response to have been revealed, never just planned. */
export function finishRepair(world: WorldState, entry: LogEntry, interrupted: boolean) {
  const repair = entry.conversation?.repair;
  if (!repair) return;
  const r = world.relationships[[...entry.characters].sort().join(':')];
  if (!r) return;
  r.lastRepairMinute = world.minute;
  if (interrupted) return;
  r.encounters++; r.lastMinute = world.minute;
  const gain = repair.accepted ? (repair.phase === 'follow-through' ? 7 : 1) : 0;
  r.trust = bound(r.trust + gain);
  r.affinity = bound(r.affinity + (repair.accepted ? 2 : 0), -100);
  if (repair.accepted && repair.phase === 'offer') r.repairCommitment = { conflictId: repair.conflictId, initiatorId: entry.characters[0] };
  if (repair.accepted && repair.phase === 'follow-through') { r.repairedConflictId = repair.conflictId; r.repairCommitment = undefined; r.unresolvedConflict = undefined; }
  world.tension = bound(world.tension - (gain ? 1 : .2));
  entry.text += repair.accepted ? ` ${repair.phase === 'follow-through' ? 'A respected choice rebuilds some trust' : 'They agree to try asking first'}; the disagreement is not erased.` : 'The request for space is respected; trust is unchanged.';
}
