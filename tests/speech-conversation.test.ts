import { describe, expect, it } from 'vitest';
import { createWorld, applyCommand, step } from '../src/simulation/engine';
import { beginConversation, advanceConversations, TURN_INTERVAL } from '../src/simulation/conversations';

function fixture() {
  const world = createWorld({ slug: 'speech-link', name: 'Speech', populationCap: 2 }, 0, 42);
  const [a, b] = world.characters;
  a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
  a.floor = b.floor = a.destination = b.destination = 0;
  const entry = beginConversation(world, a, b, true);
  return { world, a, b, entry };
}
describe('speech conversation provenance', () => {
  it('persists the exact journal ID and follows each generated or procedural turn', () => {
    const { world, a, b, entry } = fixture();
    expect(a.speechConversationId).toBe(entry.id);
    expect(JSON.parse(JSON.stringify(world)).characters[0].speechConversationId).toBe(entry.id);
    entry.conversation!.planned = [{ speakerId: b.id, text: 'A generated reply.' }];
    world.minute += TURN_INTERVAL;
    advanceConversations(world);
    expect(b.speech).toBe('A generated reply.');
    expect(b.speechConversationId).toBe(entry.id);
    expect(a.speechConversationId).toBeUndefined();
    world.minute += TURN_INTERVAL;
    advanceConversations(world);
    expect(a.speechConversationId).toBe(entry.id);
    expect(b.speechConversationId).toBeUndefined();
  });
  it('clears provenance on completion, interruption, departure and expiration', () => {
    for (const action of ['finish', 'interrupt', 'depart', 'expire']) {
      const { world, a, b, entry } = fixture();
      if (action === 'finish') {
        entry.conversation!.targetTurns = 1;
        world.minute += TURN_INTERVAL;
        advanceConversations(world);
      } else if (action === 'interrupt') {
        b.floor = 1;
        advanceConversations(world);
      } else if (action === 'depart') {
        applyCommand(world, { type: 'set-away', characterId: a.id, away: true }, 0);
      } else {
        a.speechUntil = world.minute - 1;
        step(world);
      }
      expect(a.speech).toBeUndefined();
      expect(a.speechConversationId).toBeUndefined();
    }
  });
});
