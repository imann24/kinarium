import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, relationship, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation } from '../src/simulation/conversations';
import { repairScene } from '../src/simulation/repair';
import { RELATIONSHIP_THREAD_LIMIT, recordHeardWords, recordThread } from '../src/simulation/relationship-story';
import { relationshipNarrative } from '../src/client/relationship-narrative';
import RelationshipStory from '../src/client/RelationshipStory';
import { promptRelationship } from '../src/server/llm';
import type { LogEntry } from '../src/simulation/types';

function pair(seed = 42) {
  const world = createWorld({ slug: 'story', name: 'Story', populationCap: 2 }, 0, seed);
  const [a, b] = world.characters;
  a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
  a.energy = b.energy = a.mood = b.mood = 75;
  return { world, a, b, r: relationship(world, a.id, b.id) };
}
const settle = (world: ReturnType<typeof createWorld>) => { for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); } };

describe('recorded relationship history', () => {
  it('records how a pair began, who reached out, and the subjects that moved them', () => {
    let recorded = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { world, r } = pair(seed);
      for (let tick = 0; tick < 400; tick++) step(world);
      if (!r.encounters) continue;
      recorded++;
      const story = r.story!;
      expect(story.beginning).toBeDefined();
      expect(story.connections.length + story.disagreements.length).toBeGreaterThan(0);
      for (const side of [story.connections, story.disagreements]) {
        expect(side.length).toBeLessThanOrEqual(RELATIONSHIP_THREAD_LIMIT);
        for (const t of side) expect(t.impact).toBeGreaterThan(0);
      }
      const reached = Object.values(story.perspectives).reduce((sum, p) => sum + p.reachedOut, 0);
      expect(reached).toBeGreaterThan(0); expect(reached).toBeLessThanOrEqual(r.encounters);
    }
    expect(recorded).toBeGreaterThan(5);
  });
  it('keeps the strongest subjects when a side is full and accumulates repeats', () => {
    const { r } = pair();
    for (let i = 0; i < 8; i++) recordThread(r, 'connections', `Topic ${i}`, 'conversation', i + 1, { id: i + 1, minute: i });
    recordThread(r, 'connections', 'Topic 7', 'conversation', 4, { id: 20, minute: 20 });
    expect(r.story!.connections.map(t => t.topic)).toEqual(['Topic 7', 'Topic 6', 'Topic 5', 'Topic 4', 'Topic 3']);
    expect(r.story!.connections[0]).toMatchObject({ count: 2, impact: 12, firstMinute: 7, lastMinute: 20, lastEventId: 20 });
    recordThread(r, 'connections', 'No change', 'conversation', 0, { id: 30, minute: 30 });
    expect(r.story!.connections.some(t => t.topic === 'No change')).toBe(false);
  });
  it('records shared events by how they actually moved each present pair', () => {
    const { world, r } = pair();
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1000);
    applyCommand(world, { type: 'trigger-event', eventId: 'rumor' }, 100_000);
    expect(r.story!.connections).toMatchObject([{ topic: 'A shared meal', source: 'event', impact: 3 }]);
    expect(r.story!.disagreements).toMatchObject([{ topic: 'A little rumor', source: 'event', impact: 2 }]);
    expect(r.story!.beginning).toBeUndefined();
  });
  it('remembers who offered repair, who asked for space, and when a disagreement was mended', () => {
    const { world, a, b, r } = pair();
    r.trust = 5; r.affinity = -20;
    beginConversation(world, a, b, false); settle(world);
    const conflictTopic = r.unresolvedConflict!.topic;
    world.minute += 130;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 1)); settle(world);
    expect(r.story!.perspectives[a.id]).toMatchObject({ repairsOffered: 1 });
    expect(r.story!.perspectives[b.id]).toMatchObject({ spaceRequested: 1 });
    expect(r.story!.connections.some(t => t.source === 'repair')).toBe(false);
    world.minute += 130;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)); settle(world);
    world.minute += 130;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)); settle(world);
    expect(r.story!.perspectives[a.id]).toMatchObject({ repairsOffered: 2, promisesKept: 1 });
    expect(r.story!.connections).toEqual(expect.arrayContaining([expect.objectContaining({ topic: conflictTopic, source: 'repair', count: 2 })]));
    expect(r.unresolvedConflict).toBeUndefined();
    const narrative = relationshipNarrative(r, a, b);
    expect(narrative.views[1].details.join(' ')).toContain(`saw ${a.name} keep their word`);
    expect(narrative.views[1].words).toMatchObject({ speakerId: a.id });
  });
  it('keeps the latest warm and hard words each resident heard from the other', () => {
    const { world, a, b, r } = pair();
    beginConversation(world, a, b, true); settle(world);
    beginConversation(world, a, b, false); settle(world);
    for (const [listener, speaker] of [[a, b], [b, a]]) {
      const view = r.story!.perspectives[listener.id];
      expect(view.warmWords?.speakerId).toBe(speaker.id); expect(view.hardWords?.speakerId).toBe(speaker.id);
      const thread = world.history.find(e => e.id === view.hardWords!.eventId)!.conversation!;
      expect(thread.turns.some(t => t.text === view.hardWords!.text && t.speakerId === speaker.id)).toBe(true);
    }
    // A gathering's words only fill a gap; they never displace what was said one to one.
    const kept = structuredClone(r.story!.perspectives[a.id].warmWords);
    const gathering: LogEntry = { id: 900, minute: world.minute, kind: 'conversation', text: 'Gathering', characters: [a.id, b.id, 'c9'],
      conversation: { topic: 'Group', tone: 'warm', status: 'finished', nextTurnAt: 0, targetTurns: 2, turns: [{ speakerId: b.id, text: 'A much longer line said to the whole room at once.', minute: world.minute }] } };
    recordHeardWords(world, gathering);
    expect(r.story!.perspectives[a.id].warmWords).toEqual(kept);
    delete r.story!.perspectives[a.id].warmWords;
    recordHeardWords(world, gathering);
    expect(r.story!.perspectives[a.id].warmWords).toMatchObject({ eventId: 900, group: true });
  });
});

describe('reading a relationship as a story', () => {
  it('tells how it began, what moved them, and how each sees the other', () => {
    const { world, a, b, r } = pair();
    Object.assign(r, { affinity: 50, trust: 70, encounters: 6, story: {
      beginning: { minute: 500, eventId: 3, topic: 'Company without pressure', tone: 'warm' }, friendsMinute: 900,
      connections: [{ topic: 'Rest without earning it', source: 'conversation', count: 3, impact: 12, firstMinute: 500, lastMinute: 800, lastEventId: 9 }],
      disagreements: [{ topic: 'Fairness when supplies are limited', source: 'conversation', count: 1, impact: 7, firstMinute: 600, lastMinute: 600, lastEventId: 5, mendedMinute: 850 }],
      perspectives: { [a.id]: { reachedOut: 5, repairsOffered: 0, spaceRequested: 0, promisesKept: 0, warmWords: { speakerId: b.id, text: 'Sit with me a while.', minute: 800, eventId: 9 } }, [b.id]: { reachedOut: 1, repairsOffered: 0, spaceRequested: 0, promisesKept: 0 } },
    } });
    const n = relationshipNarrative(r, a, b);
    expect(n.story[0]).toBe(`${a.name} and ${b.name} first met on Day 1 · 08:20, talking about company without pressure. By Day 1 · 15:00, they were becoming real friends.`);
    expect(n.story[1]).toContain('talking about rest without earning it brought them together, while clashing over fairness when supplies are limited once pulled them apart');
    expect(n.story[2]).toBe('Today they are close, and trust runs deep.');
    expect(n.disagreements[0].mended).toBe('Mended on Day 1 · 14:10');
    expect(n.views[0].feeling).toContain(`counts ${b.name} among the people they trust most`);
    expect(n.views[0].details).toContain(`${a.name} is usually the one to seek ${b.name} out.`);
    expect(n.views[1].details).toContain(`${b.name} has noticed ${a.name} tends to come to them first.`);
    const html = renderToStaticMarkup(<RelationshipStory relationship={r} a={a} b={b} records={[] as LogEntry[]} onSelectResident={() => {}}/>);
    for (const text of ['What has brought them closer', 'What has pulled them apart', 'How they see each other', 'Sit with me a while.', `${a.name} remembers ${b.name} saying this`]) expect(html).toContain(text);
    expect(world.relationships[`${a.id}:${b.id}`]).toBe(r);
  });
  it('reads older and unmet relationships honestly, without inventing a beginning', () => {
    const { a, b, r } = pair();
    expect(relationshipNarrative(r, a, b)).toMatchObject({ recorded: false, connections: [], disagreements: [] });
    expect(relationshipNarrative(r, a, b).story).toEqual([`${a.name} and ${b.name} haven’t had a conversation of their own yet.`, 'For now they are yet to meet.']);
    Object.assign(r, { encounters: 2, affinity: -30, trust: 10, unresolvedConflict: { id: 4, minute: 600, topic: 'Who gets a say in the garden' } });
    const n = relationshipNarrative(r, a, b);
    expect(n.story[0]).toContain('how it began predates these records');
    expect(n.story[1]).toContain('disagreement about who gets a say in the garden from Day 1 · 10:00 is still unresolved');
    expect(n.views[0].feeling).toContain('wary');
    const html = renderToStaticMarkup(<RelationshipStory relationship={r} a={a} b={b} records={[]} onSelectResident={() => {}}/>);
    expect(html).toContain('began before richer relationship records were kept');
  });
  it('gives dialogue models the recorded subjects, not the stored story text', () => {
    const { r } = pair();
    expect(promptRelationship(r)).toEqual(r);
    recordThread(r, 'connections', 'A shared meal', 'event', 3, { id: 1, minute: 1 });
    recordThread(r, 'disagreements', 'A little rumor', 'event', 2, { id: 2, minute: 2 });
    const prompt = promptRelationship(r)!;
    expect(prompt).not.toHaveProperty('story');
    expect(prompt).toMatchObject({ sharedHistory: { closerThrough: ['A shared meal'], strainedBy: ['A little rumor'] } });
  });
});
