import type { LogEntry, WorldState } from '../simulation/types';

const tokens = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
function similar(a: string, b: string) {
  const left = tokens(a), right = tokens(b);
  const shared = [...left].filter(word => right.has(word)).length;
  return shared / Math.max(1, new Set([...left, ...right]).size) >= .8;
}
/** Local-only guard: do not send more residents' histories to the provider. */
export function repeatsConversation(world: WorldState, entry: LogEntry, turns: { text: string }[]) {
  // Repeated assertions inside the same plan are never a developing exchange.
  if (turns.some((turn, i) => turns.slice(0, i).some(other => similar(turn.text, other.text)))) return true;
  const recent = world.history.filter(e => e.id !== entry.id && e.conversation).slice(-12);
  const spoken = [...(entry.conversation?.turns ?? []), ...recent.flatMap(e => e.conversation!.turns)];
  // Allow one natural callback; reject plans that substantially replay an exchange.
  return turns.filter(t => spoken.some(s => similar(t.text, s.text))).length >= 2;
}
