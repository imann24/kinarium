import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld } from '../src/simulation/engine';
import { EVENTS, TRAITS } from '../src/simulation/catalog';
import { EVENT_REPLIES } from '../src/simulation/event-voices';
import { chooseConversationScene } from '../src/simulation/conversation-scenes';

const newEvents = ['community-gathering', 'vulnerable-share', 'group-meditation'];
describe('player community care events', () => {
  it.each(newEvents)('%s applies its exact bounded effects through the existing command', id => {
    const event = EVENTS.find(e => e.id === id)!;
    for (const score of [0, 50, 100]) {
      const world = createWorld({ slug: 'events', name: 'Events' }, 0, 42);
      world.cohesion = world.tension = world.resources = score;
      const away = world.characters.at(-1)!; away.away = true;
      const awayBefore = JSON.stringify(away);
      const awayBonds = JSON.stringify(Object.values(world.relationships).filter(r => r.a === away.id || r.b === away.id));
      applyCommand(world, { type: 'trigger-event', eventId: id }, 1000);
      const bound = (n: number) => Math.max(0, Math.min(100, n));
      expect(world.cohesion).toBe(bound(score + event.cohesion));
      expect(world.tension).toBe(bound(score + event.tension));
      expect(world.resources).toBe(bound(score + event.resources));
      expect(JSON.stringify(away)).toBe(awayBefore);
      expect(JSON.stringify(Object.values(world.relationships).filter(r => r.a === away.id || r.b === away.id))).toBe(awayBonds);
      const entry = world.history.at(-1)!;
      expect(entry.characters).not.toContain(away.id);
      expect(world.characters[0].memories[0]).toMatchObject({ eventId: entry.id, kind: 'event' });
      expect(world.characters[0].memories[0].text).toContain(event.name.toLowerCase());
      expect(() => applyCommand(world, { type: 'trigger-event', eventId: id }, 1001)).toThrow('settle');
    }
  });
  it('implements the requested directions, preserves old choices and uses existing UI icons', () => {
    const byId = Object.fromEntries(EVENTS.map(e => [e.id, e]));
    expect(byId['community-gathering'].cohesion).toBeGreaterThan(0); expect(byId['community-gathering'].tension).toBeLessThan(0);
    expect(byId['vulnerable-share'].cohesion).toBeGreaterThan(0); expect(byId['vulnerable-share'].tension).toBe(0);
    expect(byId['group-meditation'].tension).toBeLessThan(0); expect(byId['group-meditation'].cohesion).toBe(0);
    for (const old of ['shared-meal', 'care-package', 'story-night', 'new-project', 'power-outage', 'rumor']) expect(byId[old]).toBeDefined();
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(EVENTS.length);
    for (const id of newEvents) expect(['soup', 'gift', 'moon', 'sprout', 'zap', 'message']).toContain(byId[id].icon);
  });
  it.each(newEvents)('%s has a grounded question and five distinct resident reactions', id => {
    const world = createWorld({ slug: 'events', name: 'Events' }, 0, 42);
    applyCommand(world, { type: 'trigger-event', eventId: id }, 0);
    const [a, b] = world.characters;
    const event = EVENTS.find(e => e.id === id)!;
    const replies = TRAITS.map(trait => {
      b.trait = trait;
      const scene = chooseConversationScene(world, a, b, true);
      expect(scene.topic).toBe(event.name); expect(scene.lines[0]).toBeTruthy();
      expect(scene.lines[1]).toBe(EVENT_REPLIES[id][trait]);
      return scene.lines[1];
    });
    expect(new Set(replies).size).toBe(5);
  });
  it('rejects unknown event IDs without changing a world', () => {
    const world = createWorld({ slug: 'events', name: 'Events' }, 0, 42), before = JSON.stringify(world);
    expect(() => applyCommand(world, { type: 'trigger-event', eventId: 'invented-meditation' }, 0)).toThrow('Unknown');
    expect(JSON.stringify(world)).toBe(before);
  });
});
