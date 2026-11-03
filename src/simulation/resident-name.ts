import { assertAppropriate } from './content-filter';
import type { WorldState } from './types';

export function validateResidentName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 30) {
    throw new Error('Enter a name between 1 and 30 characters.');
  }
  const name = value.trim();
  assertAppropriate(name, 'name');
  return name;
}

/** Names are labels, not identities. Like manual introductions, duplicates are allowed. */
export function renameResident(world: WorldState, characterId: string, value: unknown) {
  const character = world.characters.find(c => c.id === characterId);
  if (!character) throw new Error('That character could not be found.');
  const name = validateResidentName(value);
  if (character.name === name) return;
  character.name = name;
  for (const entry of world.history) {
    const thread = entry.conversation;
    if (thread?.status !== 'active') continue;
    // Unspoken AI text may mention any resident. Revealed text remains history.
    delete thread.planned;
    if (!entry.characters.includes(characterId)) continue;
    const speakerId = thread.turns.at(-1)?.speakerId;
    const people = world.characters.filter(c => entry.characters.includes(c.id));
    const speaker = people.find(c => c.id === speakerId);
    if (speaker) for (const c of people) {
      c.activity = c === speaker ? `talking with ${entry.characters.filter(id => id !== c.id).map(id => people.find(p => p.id === id)?.name).join(', ')}` : `listening to ${speaker.name}`;
    }
  }
}

/** Any changed name can make an in-flight plan's references stale. */
export const residentNames = (world: WorldState) => JSON.stringify(world.characters.map(c => [c.id, c.name]));
