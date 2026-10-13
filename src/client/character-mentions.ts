import type { Character } from '../simulation/types';
export type CharacterMention = { text: string; characterIds?: string[] };
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Resolve names against stable IDs, including away residents. Prefer the log's
// participants when names collide; genuinely ambiguous names offer a choice.
export function characterMentions(text: string, characters: Pick<Character, 'id' | 'name'>[], participants: string[] = []): CharacterMention[] {
  const names = new Map<string, string[]>();
  for (const c of characters) {
    if (!c.name) continue;
    names.set(c.name, [...(names.get(c.name) ?? []), c.id]);
  }
  if (!names.size) return [{ text }];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_])(${[...names.keys()].sort((a,b) => b.length-a.length).map(escapePattern).join('|')})(?![\\p{L}\\p{N}\\p{M}_])`, 'gu');
  const parts: CharacterMention[] = [];
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    const candidates = names.get(match[0])!;
    const involved = candidates.filter(id => participants.includes(id));
    parts.push({ text: match[0], characterIds: involved.length ? involved : candidates });
    cursor = start + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
