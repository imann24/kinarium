import type { Character, LogEntry, Memory } from './types';

export const MEMORY_LIMIT = 64;
const PINNED_MEMORIES = 8;
type MemoryDetails = Pick<Memory, 'tone' | 'salience'>;

/** Only call for a recorded event the resident participated in. No historical backfill. */
export function rememberEvent(character: Character, event: LogEntry, text: string, details: MemoryDetails = {}) {
  if (!event.characters.includes(character.id) || character.memories.some(m => m.eventId === event.id)) return;
  const memory: Memory = { text, minute: event.minute, eventId: event.id, kind: event.kind,
    participantIds: event.characters.filter(id => id !== character.id), tone: details.tone ?? 'neutral', salience: details.salience ?? 1 };
  const memories = [memory, ...character.memories];
  // Keep a few defining moments as well as recent experience; never rewrite their dates.
  const pinned = [...memories].sort((a, b) => (b.salience ?? 0) - (a.salience ?? 0) || b.minute - a.minute).slice(0, PINNED_MEMORIES);
  const retained = new Set([...pinned, ...memories.filter(m => !pinned.includes(m)).slice(0, MEMORY_LIMIT - pinned.length)]);
  character.memories = memories.filter(m => retained.has(m));
}

export interface RecallOptions { participantIds?: string[]; minute: number; limit?: number; beforeEventId?: number; }
/** Legacy memories remain readable but aren't attributed to people or events we cannot verify. */
export function recallMemories(character: Character, { participantIds = [], minute, limit = 3, beforeEventId }: RecallOptions): Memory[] {
  const score = (m: Memory) => (m.participantIds?.some(id => participantIds.includes(id)) ? 6 : 0)
    + (m.salience ?? 0) + 2 / (1 + Math.max(0, minute - m.minute) / 1440);
  return character.memories.filter(m => m.minute <= minute && (beforeEventId === undefined || (m.eventId === undefined ? m.minute < minute : m.eventId < beforeEventId)))
    .sort((a, b) => score(b) - score(a) || b.minute - a.minute || (b.eventId ?? 0) - (a.eventId ?? 0)).slice(0, Math.max(0, limit));
}

/** Small, fading influence on willingness to connect; never overrides the rest of the world. */
export function memoryInfluence(character: Character, otherId: string, minute: number): number {
  const memories = recallMemories(character, { participantIds: [otherId], minute, limit: MEMORY_LIMIT })
    .filter(m => m.participantIds?.includes(otherId) && (m.kind === 'conversation' || m.kind === 'conflict' || m.kind === 'friendship')).slice(0, 3);
  const influence = memories.reduce((sum, m) => sum + (m.tone === 'warm' ? 1 : m.tone === 'tense' ? -1 : 0)
    * .025 / (1 + Math.max(0, minute - m.minute) / 1440), 0);
  return Math.max(-.075, Math.min(.075, influence));
}
