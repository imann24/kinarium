import { recallMemories } from './memories';
import type { Character, Memory, WorldState } from './types';

/** A memory belongs to its speaker. Metadata from old saves is never invented. */
export function dialogueMemory(world: WorldState, speaker: Character, other: Character): Memory | undefined {
  return recallMemories(speaker, { participantIds: [other.id], minute: world.minute, beforeEventId: world.nextLog, limit: 64 }).find(memory => {
    if (memory.eventId === undefined || !memory.participantIds?.includes(other.id) || !['conversation', 'conflict', 'friendship', 'event', 'ritual'].includes(memory.kind ?? '')) return false;
    const source = world.history.find(e => e.id === memory.eventId);
    return !source || (source.minute <= world.minute && source.minute === memory.minute && source.kind === memory.kind && source.characters.includes(speaker.id) && source.characters.includes(other.id) && source.conversation?.status !== 'active');
  });
}
export function memoryExcerpt(memory: Memory): string | undefined {
  // Quote a whole short memory or its first complete sentence, never summarize
  // a legacy blob into an invented event or attribute another person's feelings.
  const text = memory.text.trim();
  const excerpt = text.length <= 110 ? text : text.match(/^.{1,110}?[.!?](?=\s|$)/u)?.[0];
  return excerpt && !/[“”"\n]/.test(excerpt) ? excerpt : undefined;
}

/** Keep the substance; fatigue usually shortens a contribution, not willingness to connect. */
export function statefulProgression(lines: string[], a: Character, b: Character, positive: boolean): string[] {
  if (a.energy < 10) return [...lines.slice(0, 2), 'I’m running out of energy. Could we leave the rest of this for now?', positive ? 'Yes. There is no need to find an answer while you’re worn out.' : 'We can stop here without pretending we agree.'];
  if (b.energy < 10) return [...lines.slice(0, 2), lines[2], 'I’m too tired to give this another thought right now. Let’s leave it here.'];
  const result = [...lines];
  const prefix = (index: number, text: string) => { if (result[index].length + text.length <= 220) result[index] = text + result[index]; };
  if (a.energy < 30 || b.energy < 30) {
    // Preserve the actual topic and response rather than replacing them with a refusal.
    prefix(a.energy < 30 ? 2 : 3, a.energy < 30 ? 'Briefly: ' : 'My short answer: ');
    return result.slice(0, 4);
  }
  if (a.mood < 30) prefix(2, 'I’m having a rough day, so this may come out bluntly. ');
  else if (b.mood < 30) prefix(3, 'I’m feeling low, but this matters to me. ');
  return result;
}
