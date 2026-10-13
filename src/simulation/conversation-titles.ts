import type { LogEntry, WorldState } from './types';

export const CONVERSATION_TITLE_LIMIT = 72;
const RECENT_TITLES = 12;
const filler = new Set(('a an the i me my we us our you your it its they them their he she his her to of in on at for from with by and or but so if as that this these those is are was were be been being have has had do does did can could would should will may might not no yes really just still some something anything everything more much little about how what when where who why then than now here there today time things feel feels feeling think know want said say talking conversation understand help helps make makes way all each even only also same last true sense sure thanks don’t doesn’t didn’t i’m i’d i’ve it’s that’s we’re let’s').split(' '));
const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:[’'][\p{L}]+)?/gu) ?? [];
const key = (text: string) => words(text).join(' ');
const contentWords = (text: string) => new Set(words(text).filter(word => word.length > 2 && !filler.has(word.replace(/'/g, '’'))));

/** Read-only display compatibility: never rename old saved threads during a render. */
export function conversationTitle(entry: LogEntry): string {
  return entry.conversation?.title || entry.conversation?.topic || entry.text;
}

function excerpt(sentence: string): string {
  const text = sentence.trim().replace(/^[“"\s]+|[”".!?;\s]+$/g, '');
  const limit = CONVERSATION_TITLE_LIMIT - 2; // Quotation marks signal an actual revealed line.
  if (text.length <= limit) return `“${text}”`;
  const cut = text.slice(0, limit - 1).replace(/\s+\S*$/, '').trimEnd();
  return `“${cut}…”`;
}

/** Finalize once, using revealed dialogue only. No inference calls, randomness, or planned-turn spoilers. */
export function finalizeConversationTitle(world: WorldState, entry: LogEntry) {
  const thread = entry.conversation;
  if (!thread || thread.title || thread.status === 'active') return;
  const recent = world.history.filter(other => other.id !== entry.id && other.conversation)
    .slice(-RECENT_TITLES).map(conversationTitle);
  const used = new Set(recent.map(key));
  const recentWords = new Set(recent.flatMap(title => [...contentWords(title)]));
  const candidates = new Map<string, { title: string; score: number }>();
  for (const turn of thread.turns) {
    // Recalled quotations are context, not a new contribution to this exchange.
    const spoken = turn.text.replace(/“[^”]*”/g, '').replace(/"[^"\n]*"/g, '');
    for (const sentence of spoken.split(/(?<=[.!?;])\s+/u)) {
      const title = excerpt(sentence);
      const terms = contentWords(title);
      if (terms.size < 2 || words(title).length < 3) continue;
      const novelty = [...terms].filter(term => !recentWords.has(term)).length;
      const score = Math.min(terms.size, 7) + novelty * 2 - (title.endsWith('…”') ? 2 : 0);
      const normalized = key(title);
      if (!candidates.has(normalized)) candidates.set(normalized, { title, score });
    }
  }
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  // Prefer a different real detail. If the dialogue itself repeats, an honest repeat beats invented variety.
  thread.title = ranked.find(candidate => !used.has(key(candidate.title)))?.title ?? ranked[0]?.title ?? thread.topic;
}
