import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, log, relationship } from '../src/simulation/engine';
import { EVENTS, TRAITS } from '../src/simulation/catalog';
import { EVENT_REACTIONS } from '../src/simulation/event-reactions';
import { EVENT_REPLIES } from '../src/simulation/event-voices';
import { chooseConversationScene } from '../src/simulation/conversation-scenes';
import { goodwill } from '../src/simulation/goodwill';
import type { Trait, WorldState } from '../src/simulation/types';

const ORDER: Trait[] = ['kind', 'practical', 'reserved', 'spirited', 'curious'];
const byId = (id: string) => EVENTS.find(e => e.id === id)!;
function house(population = 5) {
  const world = createWorld({ slug: 'events', name: 'Events', populationCap: 8 }, 0, 3);
  world.characters.slice(population).forEach(c => { c.away = true; });
  world.characters.forEach((c, i) => Object.assign(c, { trait: ORDER[i % ORDER.length], mood: 60, energy: 50, floor: 0, destination: 0, x: 10 + i * 4, inElevator: false }));
  return world;
}
const present = (world: WorldState) => world.characters.filter(c => !c.away);
const bonds = (world: WorldState) => JSON.stringify(Object.values(world.relationships).map(r => [r.a, r.b, r.affinity, r.trust]));

describe('a quiet day', () => {
  it('restores energy and sends everyone to the quiet floor without touching any pair', () => {
    const world = house(); const before = bonds(world);
    applyCommand(world, { type: 'trigger-event', eventId: 'quiet-day' }, 1_000);
    for (const c of present(world)) {
      expect(c.energy).toBe(50 + 15 + (EVENT_REACTIONS[c.trait].rest!.energy ?? 0));
      expect(c.destination).toBe(1);
    }
    expect(bonds(world)).toBe(before);
    expect(world.pendingGestures).toBeUndefined();
  });
});

describe('chore partners', () => {
  it('pairs the residents who know each other least and only brings those pairs closer', () => {
    const world = house(4); const [a, b, c, d] = present(world);
    // a and b are already close, as are c and d, so the chores mix them up.
    Object.assign(relationship(world, a.id, b.id), { affinity: 40, trust: 50 });
    Object.assign(relationship(world, c.id, d.id), { affinity: 40, trust: 50 });
    const resources = world.resources;
    const trustBefore = Object.fromEntries(Object.entries(world.relationships).map(([key, r]) => [key, r.trust]));
    applyCommand(world, { type: 'trigger-event', eventId: 'chore-partners' }, 1_000);
    const matched = Object.entries(world.relationships).filter(([key, r]) => r.trust > (trustBefore[key] ?? 0)).map(([key]) => key);
    expect(matched).toHaveLength(2);
    expect(matched).not.toContain([a.id, b.id].sort().join(':'));
    expect(matched).not.toContain([c.id, d.id].sort().join(':'));
    // Each matched pair heads to the same floor to work.
    for (const key of matched) { const [x, y] = key.split(':').map(id => world.characters.find(p => p.id === id)!); expect(x.destination).toBe(y.destination); }
    expect(world.resources).toBe(Math.min(100, resources + 8 + 1));
    expect(world.history.at(-1)!.text).toContain('pair up for the chores');
  });
  it('keeps an open disagreement off the chore list and leaves an odd one out to work alone', () => {
    const world = house(3); const [a, b] = present(world);
    for (const [x, y] of [[0, 1], [0, 2], [1, 2]]) Object.assign(relationship(world, present(world)[x].id, present(world)[y].id), { trust: 0, affinity: 0 });
    const conflict = log(world, 'conflict', 'A disagreement.', [a.id, b.id]);
    relationship(world, a.id, b.id).unresolvedConflict = { id: conflict.id, minute: world.minute, topic: 'The dishes' };
    applyCommand(world, { type: 'trigger-event', eventId: 'chore-partners' }, 1_000);
    expect(relationship(world, a.id, b.id).trust).toBe(0);
    expect(Object.values(world.relationships).filter(r => r.trust === 2)).toHaveLength(1);
  });
});

describe('clearing the air', () => {
  it('adds goodwill to open disagreements and has either side reach out, whatever their temperament', () => {
    const world = house(); const [, practical, , spirited] = present(world);
    const conflict = log(world, 'conflict', 'A disagreement.', [practical.id, spirited.id]);
    const r = relationship(world, practical.id, spirited.id);
    Object.assign(r, { trust: 20, affinity: -5, unresolvedConflict: { id: conflict.id, minute: world.minute, topic: 'The garden plan' } });
    const tension = world.tension;
    applyCommand(world, { type: 'trigger-event', eventId: 'clearing-air' }, 1_000);
    expect(goodwill(r)).toBe(1);
    expect(world.pendingGestures).toEqual([expect.objectContaining({ fromId: practical.id, toId: spirited.id, eventName: 'Clearing the air' })]);
    expect(world.tension).toBeGreaterThan(tension);
    expect(world.history.at(-1)!.text).toContain(`${practical.name} goes looking for ${spirited.name}`);
  });
  it('lets a resident who is struggling keep to themselves', () => {
    const world = house(); const low = present(world)[2]; low.mood = 10;
    applyCommand(world, { type: 'trigger-event', eventId: 'clearing-air' }, 1_000);
    expect(low.stateChanges?.at(-1)?.cause).toBe('Clearing the air: kept to themselves');
  });
});

describe('the three complementary events', () => {
  it.each(['quiet-day', 'chore-partners', 'clearing-air'])('%s has its own icon, reactions for every temperament and five distinct replies', id => {
    const event = byId(id);
    expect(['armchair', 'handshake', 'wind']).toContain(event.icon);
    for (const trait of TRAITS) expect(EVENT_REACTIONS[trait][event.relational]).toBeDefined();
    const world = createWorld({ slug: 'events', name: 'Events' }, 0, 42);
    applyCommand(world, { type: 'trigger-event', eventId: id }, 0);
    const [a, b] = world.characters;
    const replies = TRAITS.map(trait => {
      b.trait = trait;
      const scene = chooseConversationScene(world, a, b, true);
      expect(scene.topic).toBe(event.name); expect(scene.lines[0]).toBeTruthy();
      expect(scene.lines[1]).toBe(EVENT_REPLIES[id][trait]);
      return scene.lines[1];
    });
    expect(new Set(replies).size).toBe(5);
  });
});
