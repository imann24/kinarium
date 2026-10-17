import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyCommand, createWorld, relationship, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation, CONVERSATION_RADIUS, MAX_CONVERSATION_PARTICIPANTS, TURN_INTERVAL } from '../src/simulation/conversations';
import { conversationCallCount, enrichConversation } from '../src/server/llm';
import { applyConversationPlan } from '../src/server/conversation-policy';
import { buildResidentSummary } from '../src/simulation/resident-summary';
import { rememberEvent } from '../src/simulation/memories';
import ConversationThread from '../src/client/ConversationThread';

function fixture(count = 4) {
  const world = createWorld({ slug: 'groups', name: 'Groups', populationCap: count }, 0, 42);
  world.characters.forEach((c, i) => Object.assign(c, { x: 30 + i, floor: 0, destination: 0, energy: 70, mood: 60, trait: 'curious' }));
  return { world, people: world.characters, start: () => beginConversation(world, world.characters[0], world.characters[1], true) };
}
function advance(world: ReturnType<typeof createWorld>, ticks = 1) {
  for (let i = 0; i < ticks; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
}

describe('bounded proximity gatherings', () => {
  it('forms four residents, caps attendance, rotates all speakers and survives persistence', () => {
    const { world, people, start } = fixture(6); const entry = start();
    expect(entry.characters).toEqual(people.slice(0, MAX_CONVERSATION_PARTICIPANTS).map(c => c.id));
    const restored = structuredClone(world);
    advance(world, 8); advance(restored, 8);
    expect(world).toEqual(restored);
    expect(entry.conversation!.turns.map(t => t.speakerId)).toEqual([...entry.characters, ...entry.characters]);
    expect(entry.conversation!.status).toBe('finished');
    for (const c of people.slice(0, 4)) expect(c.memories[0].participantIds).toEqual(entry.characters.filter(id => id !== c.id));
    for (const c of people.slice(4)) expect(c.memories.some(m => m.eventId === entry.id)).toBe(false);
    expect(renderToStaticMarkup(<ConversationThread entry={entry} characters={people}/>)).toContain('4 residents');
  });
  it('joins before the first reply, excludes missed dialogue from the newcomer memory', () => {
    const { world, people, start } = fixture(3); people[2].x = 90;
    const entry = start(); const opening = entry.conversation!.turns[0].text;
    people[2].x = 32; world.minute++; advanceConversations(world);
    expect(entry.characters).toHaveLength(3);
    expect(entry.conversation!.joinedAtTurn?.[people[2].id]).toBe(1);
    advance(world, 8);
    expect(people[2].memories[0].text).not.toContain(opening);
    expect(people[0].memories[0].text).toContain(opening);
  });
  it.each(['away', 'elevator', 'floor', 'distance', 'travel', 'tired', 'mood', 'distrust', 'reserved'])("excludes a candidate with %s eligibility", reason => {
    const { world, people, start } = fixture(3); const c = people[2];
    if (reason === 'away') c.away = true;
    if (reason === 'elevator') c.inElevator = true;
    if (reason === 'floor') c.floor = c.destination = 1;
    if (reason === 'distance') c.x = people[0].x + CONVERSATION_RADIUS + 1;
    if (reason === 'travel') c.destination = 1;
    if (reason === 'tired') c.energy = 20;
    if (reason === 'mood') c.mood = 10;
    if (reason === 'distrust') relationship(world, people[1].id, c.id).trust = 0;
    if (reason === 'reserved') { c.trait = 'reserved'; c.energy = 35; }
    expect(start().characters).toHaveLength(2);
  });
  it('requires all-pairs proximity, not a chain of neighbors', () => {
    const { people, start } = fixture(4);
    people[0].x = 10; people[1].x = 25; people[2].x = 30; people[3].x = 45;
    expect(start().characters).toEqual(people.slice(0, 3).map(c => c.id));
  });
  it('rejects distant, away and duplicate initial participants', () => {
    const { world, people, start } = fixture(2);
    people[1].x = 90; expect(start).toThrow('nearby');
    people[1].x = 31; people[1].away = true; expect(start).toThrow('nearby');
    expect(() => beginConversation(world, people[0], people[0], true)).toThrow('distinct');
  });
  it('does not admit residents already conversing or join after replies/planning', () => {
    const { world, people, start } = fixture(4);
    const privateEntry = beginConversation(world, people[2], people[3], false);
    const entry = start(); expect(entry.characters).toHaveLength(2);
    expect(privateEntry.conversation!.status).toBe('active');
    advance(world); expect(entry.characters).toHaveLength(2);
    const f = fixture(3); f.people[2].x = 90; const planned = f.start();
    planned.conversation!.generationAttempted = true; f.people[2].x = 32;
    f.world.minute++; advanceConversations(f.world); expect(planned.characters).toHaveLength(2);
  });
  it.each(['move', 'away', 'travel'])('pauses the whole group on %s and discards unspoken plans', reason => {
    const { world, people, start } = fixture(); const entry = start();
    const turns = entry.characters.slice(1).map(speakerId => ({ speakerId, text: 'Unspoken plan' }));
    expect(applyConversationPlan(entry, 1, turns)).toBe(true);
    if (reason === 'move') people[2].x = 90;
    if (reason === 'away') applyCommand(world, { type: 'set-away', characterId: people[2].id, away: true }, 0);
    if (reason === 'travel') people[2].destination = 1;
    advance(world);
    expect(entry.conversation!.status).toBe('interrupted'); expect(entry.conversation!.turns).toHaveLength(1);
    for (const c of people) { expect(c.speech).toBeUndefined(); expect(c.memories[0].text).not.toContain('Unspoken plan'); }
  });
  it('never applies another speaker’s plan and never grants automatic group forgiveness', () => {
    const { world, people, start } = fixture();
    const bond = relationship(world, people[1].id, people[2].id);
    bond.unresolvedConflict = { id: 999, minute: 0, topic: 'A past disagreement' };
    const conflict = { id: 999, minute: world.minute - 10, kind: 'conflict' as const, text: 'A past disagreement', characters: [people[1].id, people[2].id] };
    world.history.push(conflict); rememberEvent(people[1], conflict, 'We disagreed.', { tone: 'tense' });
    const before = structuredClone(world.relationships); const entry = start();
    expect(applyConversationPlan(entry, 1, [{ speakerId: people[3].id, text: 'Wrong owner' }])).toBe(false);
    entry.conversation!.planned = [{ speakerId: people[3].id, text: 'Wrong owner' }];
    advance(world, 8);
    expect(entry.conversation!.turns.some(t => t.text === 'Wrong owner')).toBe(false);
    // Listeners remember what was said, but scores, beginnings and subjects stay unchanged.
    const scores = (all: typeof before) => Object.fromEntries(Object.entries(all).map(([key, { story, ...rest }]) => [key, { ...rest, threads: [...story?.connections ?? [], ...story?.disagreements ?? []], beginning: story?.beginning }]));
    expect(scores(world.relationships)).toEqual(scores(before));
    expect(bond.story?.perspectives[people[1].id]?.warmWords?.speakerId).toBe(people[2].id);
    expect(buildResidentSummary(people[1], people, world.history, world.minute).tension?.sourceEventIds).toContain(999);
  });
  it('preserves legacy pair saves and keeps repair private', () => {
    const { world, people, start } = fixture(2); const entry = start();
    delete entry.conversation!.proximity; delete entry.conversation!.joinedAtTurn;
    people[1].x = 90; const restored = structuredClone(world); advance(restored);
    expect(restored.history.at(-1)!.conversation!.turns[1].speakerId).toBe(people[1].id);
    const f = fixture(4);
    const repair = beginConversation(f.world, f.people[0], f.people[1], true, { id: 'repair:offer', topic: 'Repair', relevance: 100, eventText: undefined, lines: ['May I listen?', 'Not yet.', 'I understand.', 'Thank you.'], repair: { conflictId: 1, phase: 'offer', accepted: false } });
    expect(repair.characters).toHaveLength(2); advance(f.world, 4); expect(repair.conversation!.repair!.accepted).toBe(false);
  });
  it('forms groups in actual engine ticks and only credits the initiating pair', () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      const { world, people } = fixture(6); world.seed = seed;
      for (let i = 0; i < 20 && !found; i++) {
        step(world);
        const entry = world.history.find(e => e.characters.length > 2 && e.conversation);
        if (entry) {
          found = true;
          const [a, b, c] = entry.characters;
          expect(relationship(world, a, b).encounters).toBeGreaterThan(0);
          expect(people.find(p => p.id === c)!.stateChanges?.some(s => s.eventId === entry.id) ?? false).toBe(false);
        }
      }
    }
    expect(found).toBe(true);
  });
});

describe('group model routing', () => {
  it.each([false, true])('routes each speaker with shared growing context (same model: %s)', async sameModel => {
    const { world, people, start } = fixture();
    people.forEach((c, i) => { c.model = sameModel ? 'model-a' : `model-${i}`; });
    const entry = start();
    const run = vi.fn().mockImplementation(async (_model, inputs) => {
      const context = JSON.parse(inputs.messages[1].content);
      const speakerId = entry.characters[context.transcript.length % 4];
      return { response: JSON.stringify({ turns: [{ speakerId, text: `A specific perspective from ${speakerId} on this topic.` }] }) };
    });
    const config = { AI: { run }, LLM_ALLOWED_MODELS: 'model-a,model-0,model-1,model-2,model-3' };
    expect(conversationCallCount(config, world, entry)).toBe(3);
    const turns = await enrichConversation(config, world, entry);
    expect(turns?.map(t => t.speakerId)).toEqual(entry.characters.slice(1));
    expect(run.mock.calls.map(c => c[0])).toEqual(people.slice(1).map(c => c.model));
    expect(run.mock.calls.map(c => JSON.parse(c[1].messages[1].content).transcript.length)).toEqual([1, 2, 3]);
    expect(applyConversationPlan(entry, 1, turns)).toBe(true);
    advance(world, 3); expect(entry.conversation!.turns.slice(1).every(t => t.generated)).toBe(true);
  });
  it('falls back without partial plans on a provider failure', async () => {
    const { world, start } = fixture(); const entry = start();
    const run = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await enrichConversation({ AI: { run } }, world, entry)).toBeNull();
    expect(run).toHaveBeenCalledTimes(1); advance(world, 8);
    expect(entry.conversation!.turns).toHaveLength(8);
    expect(entry.conversation!.turns.every(t => !t.generated)).toBe(true);
  });
});
