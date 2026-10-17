import type { LogEntry, StoryHighlight, WorldState } from '../simulation/types';

export const highlightLabels: Record<StoryHighlight, string> = {
  'first-offer': 'Agreeing to try',
  settled: 'Disagreement settled',
  friendship: 'New friendship',
  turnaround: 'A turn for the better',
};

/** One journal card: the newest moment, with earlier repeated attempts folded under it. */
export interface JournalItem { entry: LogEntry; earlier: LogEntry[]; summary?: string; }

const pairKey = (e: LogEntry) => [...e.characters].sort().join(':');
const ordinal = (n: number) => ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth'][n] ?? `${n}th`;

/**
 * Repeated repair attempts on one disagreement read as one ongoing story: the newest attempt
 * stays in place and earlier ones fold beneath it. Turning points are never folded, and
 * neither is any entry in `keep` (for example one the reader asked to open).
 * `entries` must be newest first.
 */
export function foldJournal(entries: LogEntry[], world: Pick<WorldState, 'relationships' | 'characters'>, keep: ReadonlySet<number> = new Set()): JournalItem[] {
  const heads = new Map<string, JournalItem>();
  const items: JournalItem[] = [];
  for (const entry of entries) {
    const repair = entry.conversation?.repair;
    if (!repair || entry.highlight || keep.has(entry.id) || entry.conversation!.status === 'active') { items.push({ entry, earlier: [] }); continue; }
    const key = `${pairKey(entry)}#${repair.conflictId}`;
    const head = heads.get(key);
    if (head) { head.earlier.push(entry); continue; }
    const item = { entry, earlier: [] as LogEntry[] };
    heads.set(key, item); items.push(item);
  }
  for (const item of heads.values()) if (item.earlier.length) item.summary = arcSummary(item, world);
  return items;
}

/** A plain account of how the repair has gone, from the pair's recorded arc when there is one. */
function arcSummary(item: JournalItem, world: Pick<WorldState, 'relationships' | 'characters'>) {
  const entry = item.entry, repair = entry.conversation!.repair!;
  const arc = world.relationships[pairKey(entry)]?.story?.arcs?.find(a => a.conflictId === repair.conflictId);
  const shown = [entry, ...item.earlier];
  const attempts = Math.max(arc?.attempts ?? 0, shown.length);
  const space = Math.max(arc?.spaceGiven ?? 0, shown.filter(e => !e.conversation!.repair!.accepted).length);
  const [from, to] = entry.characters.map(id => world.characters.find(c => c.id === id)?.name ?? 'Someone');
  const topic = (repair.topic ?? arc?.topic ?? 'their disagreement').toLowerCase();
  const state = arc?.state === 'eased' ? ' Goodwill is easing the disagreement.' : arc?.state === 'settled' ? ' The disagreement has since settled.' : '';
  const honored = space === 0 ? `${from} keeps reaching out.` : `${from} has reached out, and ${to}’s request${space === 1 ? '' : 's'} for space ${space === 1 ? 'was honored' : `were honored ${space} times`}.`;
  return `${ordinal(attempts)} attempt about ${topic}: ${honored}${state}`;
}

/** Stories: turning points, house events, and the head of each repair story. */
export const isStoryItem = (item: JournalItem) => !!item.entry.highlight || item.entry.kind === 'event' || !!item.entry.conversation?.repair;
