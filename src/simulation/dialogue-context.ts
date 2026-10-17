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

/** Keep the subject and first response; let a disclosed state change the ending. */
export function statefulProgression(lines: string[], a: Character, b: Character, positive: boolean): string[] {
  if (a.energy < 30) return [...lines.slice(0, 2), 'I’m running out of energy. Could we leave the rest of this for now?', positive ? 'Yes. There is no need to find an answer while you’re worn out.' : 'We can stop here without pretending we agree.'];
  if (b.energy < 30) return [...lines.slice(0, 2), 'Would you like to keep exploring this, or is this enough for now?', 'I’m tired. I would rather pause than give an answer I haven’t thought through.', 'Then this can stay open. You don’t owe me a quick answer.'];
  if (a.mood < 30) return [...lines.slice(0, 2), 'I’m having a hard time finding the words today. I don’t want that to come across as not caring.', positive ? 'We don’t have to make this cheerful. You can leave some of it unsaid.' : 'I hear that. I can give you room and still have a different view.'];
  if (b.mood < 30) return [...lines.slice(0, 2), 'How does talking about this feel to you right now?', 'Honestly, I’m feeling low. I don’t have much room for an upbeat answer.', positive ? 'You don’t have to make it upbeat for me. We can let the question rest.' : 'I won’t ask you to sound cheerful. The disagreement can wait.'];
  return lines;
}
