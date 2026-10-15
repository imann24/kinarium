import { EVENTS } from './catalog';
import type { Character, LogEntry, Memory, WorldState } from './types';

export interface HistoryEpisode {
  key: string;
  signature: string;
  text: string;
  kind: Memory['kind'];
  minute: number;
  memories: Memory[];
  sourceEventIds: number[];
}
export interface ResidentSummary {
  story: HistoryEpisode[];
  defining: HistoryEpisode[];
  tension?: HistoryEpisode;
  timeline: HistoryEpisode[];
}
const words = (text: string) => text.trim().split(/\s+/).length;
const social = (kind: Memory['kind']) => kind === 'conversation' || kind === 'conflict';

/** A display-only projection. Never mutates, replaces or feeds summaries back into memories. */
export function buildResidentSummary(character: Character, characters: Character[], events: LogEntry[], minute: number): ResidentSummary {
  const byId = new Map(events.map(event => [event.id, event]));
  const groups = new Map<string, HistoryEpisode>();
  const seen = new Set<number>();
  const memories = [...character.memories].filter(m => m.minute <= minute).sort((a, b) => a.minute - b.minute || (a.eventId ?? 0) - (b.eventId ?? 0));
  for (const [index, memory] of memories.entries()) {
    if (memory.eventId !== undefined && seen.has(memory.eventId)) continue;
    if (memory.eventId !== undefined) seen.add(memory.eventId);
    const event = memory.eventId === undefined ? undefined : byId.get(memory.eventId);
    // Reject contradicted provenance; planned or ongoing dialogue is not a completed experience.
    if (event && (!event.characters.includes(character.id) || event.minute > minute || event.conversation?.status === 'active')) continue;
    const known = memory.eventId !== undefined && memory.kind !== undefined;
    const kind = known ? memory.kind : undefined;
    const ids = [...(memory.participantIds ?? [])].sort();
    const names = ids.map(id => characters.find(c => c.id === id)?.name).filter((name): name is string => !!name);
    let companion = names.length === 1 ? names[0] : names.length > 1 ? `${names[0]} and others` : 'another resident';
    // Unusually wordy user names must not break the compact prose budget.
    if (words(companion) > 6) companion = 'another resident';
    const topic = event?.conversation?.topic;
    const shortTopic = topic && words(topic) <= 6 ? ` about ${topic.toLowerCase()}` : '';
    const returnVisit = kind === 'arrival' && memory.text === 'I came back to the house.';
    const signature = `${kind ?? 'legacy'}:${ids.join(',')}:${topic ?? ''}:${memory.tone ?? ''}:${returnVisit}`;
    // Only consecutive compatible experiences within a day become an episode.
    const previous = [...groups.values()].at(-1);
    const canGroup = known && (social(kind) || kind === 'ritual') && previous?.signature === signature && Math.floor(previous.minute / 1440) === Math.floor(memory.minute / 1440);
    const key = canGroup ? previous.key : `${memory.eventId ?? 'legacy'}-${index}`;
    const existing = groups.get(key);
    if (existing) {
      existing.memories.push(memory); existing.sourceEventIds.push(memory.eventId!); existing.minute = memory.minute;
      existing.text = kind === 'ritual' ? `I joined evening tea ${existing.memories.length} times.` : `I ${kind === 'conflict' ? 'had disagreements' : 'talked'} with ${companion} ${existing.memories.length} times${shortTopic}.`;
      continue;
    }
    const occasion = event && EVENTS.find(candidate => candidate.text === event.text);
    const text = kind === 'arrival' ? returnVisit ? 'I returned to the house after time away.' : 'I arrived at the house.'
      : kind === 'departure' ? 'I took some time away from the house.'
      : kind === 'friendship' ? `I became friends with ${companion}.`
      : kind === 'conversation' ? `I talked with ${companion}${shortTopic}.`
      : kind === 'conflict' ? `I disagreed with ${companion}${shortTopic}.`
      : kind === 'ritual' ? 'I joined the house for evening tea.'
      : kind === 'event' ? occasion ? `I was here for ${occasion.name.toLowerCase()}.` : 'I took part in a shared house event.'
      : 'An earlier memory, kept in its original words.';
    groups.set(key, { key, signature, text, kind, minute: memory.minute, memories: [memory], sourceEventIds: memory.eventId === undefined ? [] : [memory.eventId] });
  }
  const timeline = [...groups.values()].reverse();
  const supported = timeline.filter(episode => episode.kind);
  const tension = supported.find(episode => episode.kind === 'conflict' && minute - episode.minute <= 1440
    && !supported.some(later => later.minute > episode.minute && social(later.kind)
      && later.memories.some(m => m.participantIds?.length === 1 && m.participantIds.some(id => episode.memories[0].participantIds?.includes(id)))));
  const used = new Set<string>(tension ? [tension.signature] : []);
  const usedText = new Set<string>(tension ? [tension.text] : []);
  const story: HistoryEpisode[] = [];
  const earliestMilestone = [...supported].reverse().find(episode => ['arrival', 'friendship', 'departure'].includes(episode.kind!));
  const candidates = [earliestMilestone, ...supported];
  let count = 0;
  for (const episode of candidates) {
    if (!episode || used.has(episode.signature) || usedText.has(episode.text) || episode.kind === 'conflict' || count + words(episode.text) > 40) continue;
    story.push(episode); used.add(episode.signature); usedText.add(episode.text); count += words(episode.text);
    if (story.length === 2) break;
  }
  const defining: HistoryEpisode[] = [];
  const definingKinds = new Set<Memory['kind']>();
  const ranked = [...supported].sort((a, b) => Math.max(...b.memories.map(m => m.salience ?? 0)) - Math.max(...a.memories.map(m => m.salience ?? 0)) || b.minute - a.minute);
  for (const episode of ranked) {
    if (used.has(episode.signature) || usedText.has(episode.text) || definingKinds.has(episode.kind) || (social(episode.kind) && Math.max(...episode.memories.map(m => m.salience ?? 0)) < 3)) continue;
    defining.push(episode); definingKinds.add(episode.kind); used.add(episode.signature); usedText.add(episode.text);
    if (defining.length === 3) break;
  }
  return { story, defining, tension, timeline };
}

/** Real time, independent of simulation speed, presence and resident activity. */
export const RESIDENT_SUMMARY_INTERVAL_MS = 60_000;
export interface SavedResidentSummary {
  version: 1;
  input: string;
  updatedAt: number;
  minute: number;
  value: ResidentSummary;
}

/** Only inputs used by the projection: no needs, movement, planned dialogue or unrelated events. */
export function residentSummaryInput(character: Character, characters: Character[], events: LogEntry[], minute: number): string {
  const ids = new Set(character.memories.map(m => m.eventId));
  const participants = new Set(character.memories.flatMap(m => m.participantIds ?? []));
  return JSON.stringify([
    character.id, character.memories,
    characters.filter(c => participants.has(c.id)).map(c => [c.id, c.name]),
    events.filter(e => ids.has(e.id)).map(e => [e.id, e.minute, e.characters, e.text, e.conversation?.topic, e.conversation?.status]),
    // Time matters only at a visibility or recent-tension boundary.
    character.memories.map(m => [m.minute <= minute, m.kind === 'conflict' && minute - m.minute <= 1440]),
  ]);
}

/** Called at persistence boundaries, never from render or dialogue generation. */
export function refreshResidentSummaries(world: WorldState, now: number): void {
  for (const character of world.characters) {
    const cached = character.residentSummary;
    if (cached?.version === 1 && now >= cached.updatedAt && now - cached.updatedAt < RESIDENT_SUMMARY_INTERVAL_MS) continue;
    const input = residentSummaryInput(character, world.characters, world.history, world.minute);
    if (cached?.version === 1 && cached.input === input) continue;
    character.residentSummary = {
      version: 1, input, updatedAt: now, minute: world.minute,
      value: structuredClone(buildResidentSummary(character, world.characters, world.history, world.minute)),
    };
  }
}
