import { EVENTS } from './catalog';
import type { LogEntry, WorldState } from './types';

// Titles are presentation metadata. Never change the topic that drives replies
// and memories, and never inspect planned (not yet spoken) dialogue.
export function conversationTitle(world: WorldState, entry: LogEntry): string {
  const thread = entry.conversation!;
  const nearby = world.history.filter(e => e.id !== entry.id && e.conversation).slice(-12);
  const used = new Set(nearby.map(e => (e.conversation!.title ?? e.conversation!.topic).toLowerCase()));
  const candidates: { text: string; score: number }[] = [];
  const add = (text: string, score: number) => candidates.push({ text, score });
  const spoken = thread.turns.map(t => t.text).join(' ');
  const eventTopic = EVENTS.some(e => e.name === thread.topic);
  const themes: [RegExp, string][] = [
    [/quiet.*unfriendly/i, 'When quiet looks unfriendly'],
    [/talk over a meal/i, 'Talking over a meal'],
    [/rather listen at first/i, 'An invitation to listen'],
    [/not always ready to talk/i, 'Company without having to talk'],
    [/invited.*room to listen/i, 'An invitation or room to listen'],
    [/notices when I go quiet/i, 'Noticing when someone goes quiet'],
    [/silence for wanting to be alone/i, 'Mistaking silence for solitude'],
    [/check with each other first/i, 'Checking with each other first'],
    [/quick decision.*shut out/i, 'Quick decisions can leave people out'],
    [/want to belong.*pretending/i, 'Belonging without pretending'],
    [/getting to know people slowly/i, 'Getting to know each other slowly'],
    [/try again after our disagreement/i, 'Trying again after a disagreement'],
  ];
  for (const [pattern, title] of themes) if (pattern.test(spoken)) add(eventTopic ? `${thread.topic}: ${title.toLowerCase()}` : title, 20);
  // Extract actual short clauses rather than asking a model to invent a headline.
  // Novel words favor the distinguishing detail over stock affirmations.
  const words = (text: string) => new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
  const earlierWords = words(nearby.flatMap(e => e.conversation!.turns.map(t => t.text)).join(' '));
  for (const turn of thread.turns) {
    if (!turn.generated) continue;
    for (const clause of turn.text.split(/[.!?;]|[—]/)) {
      const text = clause.trim().replace(/^[“”"‘’]+|[“”"‘’]+$/g, '').trim();
      if (text.length < 16 || text.length > 64 || text.split(/\s+/).length < 4) continue;
      if (/^(thank you|that makes sense|I (understand|agree)|what about you|how (do|does) (you|that))/i.test(text)) continue;
      const novelty = [...words(text)].filter(word => !earlierWords.has(word)).length;
      if (novelty < 2) continue;
      add(`“${text}”`, 30 + novelty);
    }
  }
  add(thread.topic, 10);
  const fresh = candidates.filter(c => !used.has(c.text.toLowerCase()));
  // Identical exchanges may legitimately share a title. No counters, random
  // adjectives, or fabricated events just to force global uniqueness.
  return (fresh.length ? fresh : candidates).sort((a, b) => b.score - a.score)[0].text;
}
