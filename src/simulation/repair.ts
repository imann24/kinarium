import { communityStats, recordCommunityChange } from './community-state';
import { recordRepair } from './relationship-story';
import { recordResidentChange, residentStats } from './resident-state';
import type { Character, Conversation, LogEntry, Relationship, WorldState } from './types';

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
  const openness = (c: Character) => c.mood / 400 + (c.trait === 'kind' ? .1 : c.trait === 'reserved' ? -.06 : c.trait === 'spirited' ? -.03 : 0);
  const readiness = Math.max(.08, Math.min(.8, .2 + r.trust / 250 + r.affinity / 500
    + Math.min(openness(a), openness(b)) - world.tension / 400));
  const accepted = roll < readiness;
  const topic = conflict.topic;
  const variant = (world.nextLog + Math.floor((r.lastRepairMinute ?? conflict.minute) / 120)) % 3;
  const openings = [
    `There is still tension between us after our disagreement about ${topic.toLowerCase()}. Could I listen to what is still bothering you?`,
    `Our disagreement about ${topic.toLowerCase()} is still tense. I want to understand your side, even if it stings. Where should I start?`,
    `I don’t want the tension over ${topic.toLowerCase()} to be all we have. What have I missed about your point of view?`,
  ];
  const requests = [
    'I want room to disagree without having to defend it immediately. Can you give me that?',
    'Let me finish a thought before we argue with it. Then ask what I want, instead of guessing.',
    'I need a say in what happens between us. Ask me first, even if my answer is inconvenient.',
  ];
  const refusals = [
    'Not yet. I don’t want to go through it again right now.',
    'I’m still angry. I can hear the offer, but I’m not ready to accept it.',
    'I want this to change too, but I need more time before we try again.',
  ];
  const lines = following ? [
    `After our disagreement about ${topic.toLowerCase()}, I said I would ask first. Would you like to choose where we sit, or would you prefer space?`,
    accepted ? 'I’ll choose a place to sit. Please let me finish explaining before you answer.' : 'Space, please. I’m not ready to sit together.',
    accepted ? 'Go ahead. I’ll wait and listen.' : 'All right. I’ll leave you room and won’t press for an answer.',
    accepted ? 'Thank you for waiting. Being able to make that choice helps, even though I’m still cautious.' : 'Thank you for accepting that. I still need time.',
  ] : [
    openings[variant],
    accepted ? requests[variant] : refusals[variant],
    accepted ? 'Yes. Next time we share a space, I’ll ask what you want before making a choice for us.' : 'I hear you. I’ll give you space before asking again.',
    accepted ? 'I’m willing to see how that goes. A promise alone doesn’t settle this.' : 'That is what I need right now. This is still unresolved.',
  ];
  return { eventText: undefined, id: following ? 'repair:follow-through' : 'repair:offer', topic: following ? 'Following through after disagreement' : 'An attempt to repair', lines, relevance: 100,
    repair: { conflictId: conflict.id, phase: following ? 'follow-through' : 'offer', accepted, topic } as NonNullable<Conversation['repair']> };
}

/** Consequences require the action AND response to have been revealed, never just planned. */
export function finishRepair(world: WorldState, entry: LogEntry, interrupted: boolean) {
  const repair = entry.conversation?.repair;
  if (!repair || repair.applied) return;
  if (!interrupted && entry.conversation!.turns.length < entry.conversation!.targetTurns) return;
  const r = world.relationships[[...entry.characters].sort().join(':')];
  if (!r) return;
  repair.applied = true;
  r.lastRepairMinute = world.minute;
  if (interrupted) { entry.text += ' Repair paused; no trust or wellbeing restored.'; return; }
  // A stale plan cannot settle a newer disagreement or reward the same repair twice.
  if (r.repairedConflictId === repair.conflictId || (r.unresolvedConflict && r.unresolvedConflict.id !== repair.conflictId)) return;
  if (repair.phase === 'offer' && r.repairCommitment?.conflictId === repair.conflictId) return;
  if (repair.phase === 'follow-through' && (r.repairCommitment?.conflictId !== repair.conflictId || r.repairCommitment.initiatorId !== entry.characters[0])) return;
  r.encounters++; r.lastMinute = world.minute;
  const previous = r.affinity;
  // Older saved repairs lack their topic; recover it from the conflict when still known.
  const topic = repair.topic ?? (r.unresolvedConflict?.id === repair.conflictId ? r.unresolvedConflict.topic : world.history.find(e => e.id === repair.conflictId)?.conversation?.topic) ?? 'An earlier disagreement';
  const gain = repair.accepted ? (repair.phase === 'follow-through' ? 7 : 1) : 0;
  r.trust = bound(r.trust + gain);
  r.affinity = bound(r.affinity + (repair.accepted ? 2 : 0), -100);
  recordRepair(r, entry, topic, r.affinity - previous);
  if (repair.accepted && repair.phase === 'offer') r.repairCommitment = { conflictId: repair.conflictId, initiatorId: entry.characters[0] };
  if (repair.accepted && repair.phase === 'follow-through') { r.repairedConflictId = repair.conflictId; r.repairCommitment = undefined; r.unresolvedConflict = undefined; }
  if (repair.accepted) {
    const beforeCommunity = communityStats(world);
    const followThrough = repair.phase === 'follow-through';
    world.tension = bound(world.tension - (followThrough ? 2 : .5));
    world.cohesion = bound(world.cohesion + (followThrough ? 1 : .25));
    for (const id of entry.characters) {
      const c = world.characters.find(person => person.id === id);
      if (!c) continue;
      const before = residentStats(c);
      c.mood = bound(c.mood + (followThrough ? 3 : 1));
      c.belonging = bound(c.belonging + (followThrough ? 3 : 1));
      recordResidentChange(c, before, world.minute, followThrough ? 'Repair: choice respected' : 'Repair: tension acknowledged', entry.id);
    }
    recordCommunityChange(world, beforeCommunity, followThrough ? 'Repair: choice respected' : 'Repair: tension acknowledged', entry.id);
    r.lastConnectionMinute = world.minute;
  }
  entry.text += repair.accepted ? ` ${repair.phase === 'follow-through' ? 'A respected choice rebuilds some trust' : 'They agree to try asking first'}; mood and belonging improve, and house tension eases. The disagreement is not erased.` : 'The request for space is respected; trust is unchanged.';
}
