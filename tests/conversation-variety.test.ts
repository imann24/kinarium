import { describe, expect, it, vi } from 'vitest';
import { EVENTS, TRAITS } from '../src/simulation/catalog';
import { createWorld, applyCommand } from '../src/simulation/engine';
import { beginConversation, advanceConversations, interruptConversations, TURN_INTERVAL } from '../src/simulation/conversations';
import { chooseConversationScene } from '../src/simulation/conversation-scenes';
import { repeatsConversation } from '../src/server/conversation-variety';
import { enrichConversation } from '../src/server/llm';
import type { WorldState } from '../src/simulation/types';

function finish(world: WorldState) {
  for (let i = 0; i < 8; i++) { world.minute += TURN_INTERVAL; advanceConversations(world); }
}
function worldFor(seed = 42, templateId = 'common-house') {
  const world = createWorld({ slug: 'variety', name: 'Variety', templateId }, 0, seed);
  world.characters.forEach(c => { c.x = 10; c.destination = c.floor = 0; c.inElevator = false; });
  // Keep pairwise scene/variety coverage isolated from optional group joining.
  world.characters.slice(2).forEach(c => { c.x = 80; });
  return world;
}
describe('procedural conversational variety', () => {
  it('samples 360 seeded encounters across settings, personalities and tones', () => {
    const totals = { encounters: 0, uniqueTranscripts: 0, repeatedAdjacentTopics: 0 };
    for (const templateId of ['common-house', 'makers-house', 'harbor-house']) for (const [seed, trait] of TRAITS.entries()) for (const positive of [true, false]) {
      const world = worldFor(seed + 1, templateId);
      const [a, b] = world.characters; a.trait = trait; b.trait = TRAITS[(seed + 2) % TRAITS.length];
      const topics: string[] = [], transcripts: string[] = [], scenes: string[] = [];
      for (let i = 0; i < 12; i++) {
        const entry = beginConversation(world, a, b, positive);
        const restored = JSON.parse(JSON.stringify(world));
        finish(world); finish(restored);
        expect(restored).toEqual(world);
        const t = entry.conversation!;
        expect(t.status).toBe('finished');
        expect(t.turns.length).toBeGreaterThanOrEqual(4);
        expect(t.turns.length).toBeLessThanOrEqual(6);
        expect(t.turns.every((turn, index) => turn.speakerId === [a.id, b.id][index % 2] && turn.text.length <= 220)).toBe(true);
        expect(t.fallbackTurns).toBeUndefined();
        if (topics.at(-1) === t.topic) expect(t.sceneId).toBe('revisit');
        scenes.push(t.sceneId!);
        topics.push(t.topic); transcripts.push(t.turns.map(t => t.text).join('\n'));
      }
      expect(scenes.some((scene, i) => i > 0 && scene === scenes[i - 1])).toBe(false);
      expect(new Set(topics).size).toBeGreaterThanOrEqual(positive ? 6 : 3);
      expect(new Set(transcripts).size).toBeGreaterThanOrEqual(positive ? 7 : 4);
      totals.encounters += topics.length;
      totals.uniqueTranscripts += new Set(transcripts).size;
      totals.repeatedAdjacentTopics += topics.filter((topic, i) => i > 0 && topic === topics[i - 1]).length;
    }
    expect(totals.repeatedAdjacentTopics).toBeLessThanOrEqual(totals.encounters / 4);
    console.log('Seeded fixed-pair sample:', JSON.stringify(totals));
  });
  it('avoids replaying the same opening across nearby pairs', () => {
    const world = worldFor();
    const openings: string[] = [];
    for (let i = 0; i < 6; i++) {
      world.characters.forEach(c => { c.x = 80; });
      world.characters[i].x = world.characters[(i + 1) % 6].x = 10;
      const entry = beginConversation(world, world.characters[i], world.characters[(i + 1) % 6], true);
      openings.push(entry.conversation!.turns[0].text); finish(world);
    }
    expect(new Set(openings).size).toBeGreaterThanOrEqual(5);
  });
  it('grounds setting, scarcity, personality, and relationship without consuming random state', () => {
    const world = worldFor(5, 'harbor-house');
    const [a, b] = world.characters;
    a.trait = 'curious'; b.trait = 'practical'; b.belonging = 80;
    const seed = world.seed;
    const scene = chooseConversationScene(world, a, b, true);
    expect(scene.topic).toContain('dockside kitchen');
    expect(scene.lines[1]).toContain('useful');
    expect(world.seed).toBe(seed);
    world.resources = 10;
    expect(chooseConversationScene(world, a, b, false).lines[0]).toContain('Supplies are low');
    world.resources = 80;
    const bond = Object.values(world.relationships).find(r => [r.a, r.b].includes(a.id) && [r.a, r.b].includes(b.id))!;
    bond.trust = 10;
    a.trait = 'practical';
    const guarded = chooseConversationScene(world, a, b, true);
    expect(guarded.id).toBe('help');
  });
  it.each(EVENTS)('uses a distinct grounded response to $id and does not keep replaying it', event => {
    const world = worldFor(); const [a, b] = world.characters;
    applyCommand(world, { type: 'trigger-event', eventId: event.id }, 0);
    // Some events send residents to another floor; talk once the pair has settled there together.
    for (const c of [a, b]) Object.assign(c, { floor: a.destination, destination: a.destination, x: 10 });
    const first = beginConversation(world, a, b, false); finish(world);
    expect(first.conversation!.topic).toBe(event.name);
    expect(first.text).toContain(event.text);
    const next = beginConversation(world, a, b, false);
    expect(next.conversation!.sceneId).not.toBe(first.conversation!.sceneId);
  });
  it('never turns unrevealed procedural lines into titles or memories', () => {
    const world = worldFor(); const [a, b] = world.characters;
    const entry = beginConversation(world, a, b, true);
    const unspoken = entry.conversation!.fallbackTurns!;
    interruptConversations(world, a.id);
    expect(entry.conversation!.fallbackTurns).toBeUndefined();
    const memory = a.memories.find(m => m.eventId === entry.id)!;
    expect(unspoken.every(text => !memory.text.includes(text))).toBe(true);
    expect(entry.conversation!.turns).toHaveLength(1);
  });
  it('keeps legacy active saves usable without procedural arc metadata', () => {
    const world = worldFor(); const entry = beginConversation(world, world.characters[0], world.characters[1], true);
    delete entry.conversation!.fallbackTurns; delete entry.conversation!.sceneId;
    entry.conversation!.topic = 'Company at the common table';
    finish(world);
    expect(entry.conversation!.status).toBe('finished');
    expect(entry.conversation!.turns.every(t => typeof t.text === 'string')).toBe(true);
  });
});

describe('AI variety within existing data boundaries', () => {
  const lines = ['I like to listen before offering an opinion.', 'Would you want an invitation even if you chose silence?', 'Yes, having the choice matters more than being expected to speak.'];
  it('rejects replayed or internally duplicated plans, allowing one callback', async () => {
    const world = worldFor(); const [a,b] = world.characters;
    const old = beginConversation(world, a, b, true);
    old.conversation!.turns = lines.map((text, i) => ({ speakerId: i % 2 ? a.id : b.id, text, minute: 0 }));
    finish(world);
    const entry = beginConversation(world, a, b, true);
    const turns = lines.map((text, i) => ({ speakerId: i % 2 ? a.id : b.id, text }));
    const run = vi.fn().mockResolvedValue({ response: JSON.stringify({ turns }) });
    expect(await enrichConversation({ AI: { run } }, world, entry)).toBeNull();
    expect(repeatsConversation(world, entry, [{ text: lines[0] }, { text: 'Which tools would make a shared workshop easier to use?' }, { text: 'Labels might help me find things without interrupting someone.' }])).toBe(false);
    expect(repeatsConversation(world, entry, [{ text: lines[0] }, { text: lines[0].toUpperCase() }])).toBe(true);
    const context = JSON.parse(run.mock.calls[0][1].messages[1].content);
    expect(Object.keys(context).sort()).toEqual(['participantOrder','relationships','topic','tone','transcript','characters','relationship','community','recentEvents','previousConversation'].sort());
    const openingTitle = entry.conversation!.title;
    world.minute += TURN_INTERVAL; advanceConversations(world);
    expect(entry.conversation!.title).toBe(openingTitle);
    expect(entry.conversation!.turns[1].generated).toBeUndefined();
    expect(entry.conversation!.turns[1].text).toBe(entry.conversation!.fallbackTurns![0]);
  });
});
