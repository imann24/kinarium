import type { LogEntry } from '../simulation/types';

/** In-flight results must still answer exactly the transcript used in the prompt. */
export function applyConversationPlan(entry: LogEntry | undefined, turnCount: number, turns: { speakerId: string; text: string }[] | null) {
  if (!turns || entry?.conversation?.status !== 'active' || entry.conversation.turns.length !== turnCount) return false;
  entry.conversation.planned = turns;
  entry.conversation.targetTurns = turnCount + turns.length;
  return true;
}
export function dailyConversationLimit(configured?: string) {
  const value = Number(configured ?? 240);
  return Number.isFinite(value) ? Math.max(0, Math.min(10000, Math.floor(value))) : 240;
}
