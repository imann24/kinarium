import type { LogEntry, Relationship, RelationshipPerspective, RelationshipStory, RelationshipThread, WorldState } from './types';

/** Per side, so a long friendship still keeps its few defining subjects rather than every chat. */
export const RELATIONSHIP_THREAD_LIMIT = 5;
const QUOTE_LIMIT = 220;

export function relationshipStory(r: Relationship): RelationshipStory {
  return r.story ??= { connections: [], disagreements: [], perspectives: {} };
}
export function perspective(r: Relationship, holderId: string): RelationshipPerspective {
  return relationshipStory(r).perspectives[holderId] ??= { reachedOut: 0, repairsOffered: 0, spaceRequested: 0, promisesKept: 0 };
}
const pairOf = (world: WorldState, a: string, b: string) => world.relationships[[a, b].sort().join(':')];

/** Repeated subjects accumulate; the weakest (then oldest) is forgotten when a side is full. */
export function recordThread(r: Relationship, side: 'connections' | 'disagreements', topic: string, source: RelationshipThread['source'], change: number, event: Pick<LogEntry, 'id' | 'minute'>) {
  // Decay makes affinity fractional; a tenth of a point is plenty for display.
  const impact = Math.round(change * 10) / 10;
  if (impact <= 0) return;
  const story = relationshipStory(r);
  const list = story[side];
  const existing = list.find(t => t.topic === topic && t.source === source);
  if (existing) Object.assign(existing, { count: existing.count + 1, impact: Math.round((existing.impact + impact) * 10) / 10, lastMinute: event.minute, lastEventId: event.id });
  else list.push({ topic, source, count: 1, impact, firstMinute: event.minute, lastMinute: event.minute, lastEventId: event.id });
  if (side === 'disagreements') for (const t of list) if (t.topic === topic) delete t.mendedMinute;
  list.sort((x, y) => y.impact - x.impact || y.lastMinute - x.lastMinute);
  list.length = Math.min(list.length, RELATIONSHIP_THREAD_LIMIT);
}

/** A one-to-one encounter. `delta` is the affinity actually moved, after clamping. */
export function recordEncounter(r: Relationship, entry: LogEntry, initiatorId: string, delta: number) {
  const story = relationshipStory(r);
  const topic = entry.conversation?.topic ?? 'An ordinary moment';
  const tone = entry.kind === 'conflict' ? 'tense' : 'warm';
  story.beginning ??= { minute: entry.minute, eventId: entry.id, topic, tone };
  perspective(r, initiatorId).reachedOut++;
  if (tone === 'warm') recordThread(r, 'connections', topic, 'conversation', delta, entry);
  else recordThread(r, 'disagreements', topic, 'conversation', -delta, entry);
}

export function recordFriendship(r: Relationship, minute: number) { relationshipStory(r).friendsMinute ??= minute; }

/** Shared house events nudge every present pair; only record those that actually moved them. */
export function recordSharedEvent(r: Relationship, name: string, delta: number, event: LogEntry) {
  if (delta > 0) recordThread(r, 'connections', name, 'event', delta, event);
  else recordThread(r, 'disagreements', name, 'event', -delta, event);
}

/** Called only for revealed repair exchanges that reached their end. */
export function recordRepair(r: Relationship, entry: LogEntry, topic: string, delta: number) {
  const repair = entry.conversation!.repair!;
  const [initiator, responder] = entry.characters;
  if (repair.phase === 'offer') perspective(r, initiator).repairsOffered++;
  if (!repair.accepted) { perspective(r, responder).spaceRequested++; return; }
  recordThread(r, 'connections', topic, 'repair', Math.max(delta, 1), entry);
  if (repair.phase === 'follow-through') {
    perspective(r, initiator).promisesKept++;
    for (const t of relationshipStory(r).disagreements) if (t.topic === topic) t.mendedMinute = entry.minute;
  }
}

/** From each conversation, a listener keeps the fullest line they heard from each other speaker, per tone. */
export function recordHeardWords(world: WorldState, entry: LogEntry) {
  const thread = entry.conversation;
  if (!thread) return;
  const slot = thread.tone === 'tense' ? 'hardWords' : 'warmWords';
  const group = entry.characters.length > 2;
  for (const listener of entry.characters) {
    const heard = thread.turns.slice(thread.joinedAtTurn?.[listener] ?? 0);
    for (const speaker of entry.characters) {
      const r = speaker === listener ? undefined : pairOf(world, listener, speaker);
      // Closing pleasantries are short; the longest line usually carries what was actually said.
      const turn = r && heard.filter(t => t.speakerId === speaker).reduce<typeof heard[number] | undefined>((best, t) => !best || t.text.length >= best.text.length ? t : best, undefined);
      if (!r || !turn) continue;
      const view = perspective(r, listener);
      if (group && view[slot] && !view[slot].group) continue;
      const text = turn.text.length > QUOTE_LIMIT ? `${turn.text.slice(0, QUOTE_LIMIT - 1).trimEnd()}…` : turn.text;
      view[slot] = { speakerId: speaker, text, minute: turn.minute, eventId: entry.id, ...(group ? { group: true as const } : {}) };
    }
  }
}
