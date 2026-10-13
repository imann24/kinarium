import { describe, expect, it, vi } from 'vitest';
import { advance, applyCommand, createWorld, step, TICK_MS } from '../src/simulation/engine';
import { MEMORY_LIMIT, memoryInfluence, recallMemories, rememberEvent } from '../src/simulation/memories';
import { enrichDialogue } from '../src/server/llm';
const makeWorld = () => createWorld({ slug: 'memories', name: 'Memories' }, 0, 42);

describe('resident personal history', () => {
  it('records grounded, distinct perspectives with chronological provenance', () => {
    const world = makeWorld();
    for (let i = 0; i < 100; i++) step(world);
    const encounter = world.history.find(e => e.kind === 'conversation' || e.kind === 'conflict')!;
    const [a, b] = encounter.characters.map(id => world.characters.find(c => c.id === id)!);
    const first = a.memories.find(m => m.eventId === encounter.id)!;
    const second = b.memories.find(m => m.eventId === encounter.id)!;
    expect(first.text).toContain(b.name); expect(second.text).toContain(a.name);
    expect(first.text).not.toBe(second.text);
    expect(first.minute).toBe(encounter.minute); expect(first.participantIds).toEqual([b.id]);
    for (const c of world.characters) for (const m of c.memories) {
      const event = world.history.find(e => e.id === m.eventId)!;
      expect(event.characters).toContain(c.id); expect(event.minute).toBe(m.minute);
    }
  });
  it('preserves old text/time memories without inventing provenance on load or catch-up', () => {
    const world = makeWorld(); const c = world.characters[0];
    c.memories = [{ text: 'An old saved memory.', minute: 100 }]; c.away = true;
    const restored = JSON.parse(JSON.stringify(world)); advance(restored, 100_000 * TICK_MS);
    expect(restored.characters[0].memories).toEqual(c.memories);
    expect(memoryInfluence(c, 'c2', world.minute)).toBe(0);
    expect(recallMemories(c, { minute: world.minute })).toEqual(c.memories);
  });
  it('records departure, return and events only for actual participants', () => {
    const world = makeWorld(); const c = world.characters[0];
    applyCommand(world, { type: 'set-away', characterId: c.id, away: true }, 0);
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1);
    expect(c.memories[0].kind).toBe('departure');
    expect(world.characters[1].memories[0]).toMatchObject({ kind: 'event', tone: 'warm' });
    applyCommand(world, { type: 'set-away', characterId: c.id, away: false }, 2);
    expect(c.memories[0]).toMatchObject({ kind: 'arrival', text: 'I came back to the house.' });
  });
  it('bounds retention while preserving defining moments and deduplicating events', () => {
    const c = makeWorld().characters[0]; const arrival = c.memories[0];
    for (let id = 100; id < 200; id++) {
      const event = { id, minute: id + 500, kind: 'conversation' as const, characters: [c.id, 'c2'], text: 'An encounter' };
      rememberEvent(c, event, `Moment ${id}`); rememberEvent(c, event, 'Duplicate');
    }
    expect(c.memories).toHaveLength(MEMORY_LIMIT); expect(c.memories).toContainEqual(arrival);
    expect(c.memories[0].eventId).toBe(199); expect(c.memories.some(m => m.text === 'Duplicate')).toBe(false);
    rememberEvent(c, { id: 300, minute: 900, kind: 'event', characters: ['c2'], text: 'Elsewhere' }, 'Not witnessed');
    expect(c.memories[0].eventId).toBe(199);
  });
  it('retrieves salient shared context, excludes current/future events and fades bounded influence', () => {
    const c = makeWorld().characters[0];
    c.memories = [
      { text: 'Shared disagreement', minute: 500, eventId: 10, kind: 'conflict', participantIds: ['c2'], tone: 'tense', salience: 3 },
      { text: 'Unrelated arrival', minute: 501, eventId: 11, kind: 'arrival', salience: 5 },
      { text: 'Current event', minute: 502, eventId: 12 },
      { text: 'Future event', minute: 504, eventId: 13 },
    ];
    expect(recallMemories(c, { participantIds: ['c2'], minute: 502, beforeEventId: 12, limit: 1 })[0].eventId).toBe(10);
    expect(recallMemories(c, { minute: 502, beforeEventId: 12 }).map(m => m.eventId)).not.toContain(12);
    expect(memoryInfluence(c, 'c2', 502)).toBeLessThan(0);
    expect(memoryInfluence(c, 'c2', 10000)).toBeGreaterThan(memoryInfluence(c, 'c2', 502));
    expect(memoryInfluence(c, 'c3', 502)).toBe(0);
    expect(Math.abs(memoryInfluence(c, 'c2', 502))).toBeLessThanOrEqual(.075);
  });
  it('feeds prior shared memories to dialogue without treating the current event as history', async () => {
    const world = makeWorld(); const c = world.characters[0];
    c.memories = [{ text: 'Earlier disagreement', minute: 490, eventId: 8, kind: 'conflict', participantIds: ['c2'], tone: 'tense', salience: 3 }, { text: 'This encounter', minute: 500, eventId: 9 }];
    const run = vi.fn().mockResolvedValue({ response: 'Let’s try again.' });
    await enrichDialogue({ AI: { run } }, world, { id: 9, minute: 500, kind: 'conversation', characters: ['c1', 'c2'], text: 'They meet.' });
    const context = JSON.parse(run.mock.calls[0][1].messages[1].content);
    expect(context.characters[0].memories.map((m: { text: string }) => m.text)).toEqual(['Earlier disagreement']);
  });
  it('uses remembered disagreements in procedural dialogue', () => {
    const world = makeWorld();
    for (const c of world.characters) c.memories = world.characters.filter(other => other !== c).map(other => {
      const eventId = world.nextLog++;
      world.history.push({ id: eventId, minute: 480, kind: 'conflict', characters: [c.id, other.id], text: 'A recorded disagreement.' });
      return { text: 'We disagreed.', minute: 480, eventId, kind: 'conflict', participantIds: [other.id], tone: 'tense', salience: 3 };
    });
    for (let i = 0; i < 100; i++) step(world);
    expect(world.history.some(e => e.conversation?.turns.some(t => t.text.includes('after our disagreement') || t.text.includes('still on my mind')))).toBe(true);
  });
});
