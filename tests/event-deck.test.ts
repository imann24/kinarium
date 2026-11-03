import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, log, relationship } from '../src/simulation/engine';
import { EVENTS, TRAITS } from '../src/simulation/catalog';
import { EVENT_REACTIONS } from '../src/simulation/event-reactions';
import { EVENT_REPLIES } from '../src/simulation/event-voices';
import { goodwill } from '../src/simulation/goodwill';
import type { Character, Trait, WorldState } from '../src/simulation/types';

const ORDER: Trait[] = ['kind', 'practical', 'reserved', 'spirited', 'curious'];
const NEW_EVENTS = ['burst-pipe', 'missing-thing', 'shouting-match', 'lean-week', 'sleepless-night', 'broken-confidence', 'left-out', 'plans-fall-through', 'house-vote', 'unexpected-bill', 'someone-ill', 'birthday-surprise'];
const byId = (id: string) => EVENTS.find(e => e.id === id)!;
function house(population = 5) {
  const world = createWorld({ slug: 'deck', name: 'Deck', populationCap: 8 }, 0, 3);
  world.characters.slice(population).forEach(c => { c.away = true; });
  world.characters.forEach((c, i) => Object.assign(c, { trait: ORDER[i % ORDER.length], mood: 60, energy: 50, belonging: 50, floor: 0, destination: 0, x: 10 + i * 4, inElevator: false }));
  const people = present(world);
  for (const [i, a] of people.entries()) for (const b of people.slice(i + 1)) Object.assign(relationship(world, a.id, b.id), { affinity: 10, trust: 30 });
  return world;
}
const present = (world: WorldState) => world.characters.filter(c => !c.away);
const pair = (world: WorldState, a: Character, b: Character) => relationship(world, a.id, b.id);
const trigger = (world: WorldState, id: string) => applyCommand(world, { type: 'trigger-event', eventId: id }, 1_000);
function openConflict(world: WorldState, a: Character, b: Character, topic = 'The dishes') {
  const conflict = log(world, 'conflict', 'A disagreement.', [a.id, b.id]);
  return Object.assign(pair(world, a, b), { unresolvedConflict: { id: conflict.id, minute: world.minute, topic } });
}

describe('the larger event deck', () => {
  it('adds twelve events, most of them with negative consequences', () => {
    const added = NEW_EVENTS.map(byId);
    expect(added.every(Boolean)).toBe(true);
    expect(EVENTS).toHaveLength(24);
    expect(added.filter(e => e.tone === 'disruptive')).toHaveLength(8);
    for (const e of added.filter(e => e.tone === 'disruptive')) expect(e.mood).toBeLessThan(0);
  });
  it('keeps every event distinct: its own name, story, numbers, and for new events its own icon and mechanic', () => {
    for (const key of ['id', 'name', 'description', 'text'] as const) expect(new Set(EVENTS.map(e => e[key])).size).toBe(EVENTS.length);
    const profile = (e: typeof EVENTS[number]) => [e.relational, e.cohesion, e.tension, e.resources, e.mood, e.energy ?? 0].join(':');
    expect(new Set(EVENTS.map(profile)).size).toBe(EVENTS.length);
    for (const id of NEW_EVENTS) {
      const event = byId(id);
      expect(EVENTS.filter(e => e.icon === event.icon)).toHaveLength(1);
      expect(EVENTS.filter(e => e.relational === event.relational)).toHaveLength(1);
    }
  });
  it.each(NEW_EVENTS)('%s gives each temperament its own reaction and reply', id => {
    const event = byId(id);
    const labels = TRAITS.map(trait => EVENT_REACTIONS[trait][event.relational]!.label);
    expect(new Set(labels).size).toBe(5);
    expect(new Set(TRAITS.map(trait => EVENT_REPLIES[id][trait])).size).toBe(5);
  });
});

describe('negative events and repair', () => {
  it('a shouting match opens a disagreement between the pair most at odds, which clearing the air can then help mend', () => {
    const world = house(); const [kind, practical, , spirited] = present(world);
    Object.assign(pair(world, practical, spirited), { affinity: -10, trust: 10 });
    trigger(world, 'shouting-match');
    const r = pair(world, practical, spirited);
    expect(r.unresolvedConflict).toMatchObject({ topic: 'Who raised their voice first' });
    expect([r.affinity, r.trust]).toEqual([-18, 6]);
    expect(Object.values(world.relationships).filter(x => x.unresolvedConflict)).toHaveLength(1);
    expect(practical.stateChanges?.at(-1)?.cause).toBe(`A shouting match: had it out with ${spirited.name}`);
    expect(spirited.destination).not.toBe(practical.destination);
    expect(world.history.at(-1)!.text).toContain(`${practical.name} and ${spirited.name} have it out`);
    expect(world.history.at(-1)!.text).toContain(`${kind.name} stepped between them`);
    applyCommand(world, { type: 'trigger-event', eventId: 'clearing-air' }, 100_000);
    expect(goodwill(r)).toBe(1);
    expect(world.pendingGestures?.some(g => [g.fromId, g.toId].sort().join(':') === [practical.id, spirited.id].sort().join(':'))).toBe(true);
  });
  it('a shouting match flares an old disagreement rather than inventing a second when every pair is already at odds', () => {
    const world = house(2); const [a, b] = present(world);
    const r = openConflict(world, a, b); r.goodwill = 2;
    const id = r.unresolvedConflict!.id;
    trigger(world, 'shouting-match');
    expect(r.unresolvedConflict!.id).toBe(id);
    expect(goodwill(r)).toBe(1.5);
  });
  it('a broken confidence breaks trust between the closest pair and opens a disagreement there', () => {
    const world = house(); const [a, b, c, d] = present(world);
    Object.assign(pair(world, a, b), { affinity: 40, trust: 80 });
    trigger(world, 'broken-confidence');
    expect(pair(world, a, b)).toMatchObject({ trust: 68, affinity: 34, unresolvedConflict: expect.objectContaining({ topic: 'A broken confidence' }) });
    expect(pair(world, c, d).trust).toBe(29);
    expect(world.history.at(-1)!.text).toContain(`${a.name} let slip something ${b.name} had told them`);
  });
  it('a burst pipe crowds everyone downstairs and wears goodwill off an open disagreement', () => {
    const world = house(); const [a, b, c, d] = present(world);
    world.characters.forEach(p => { p.floor = p.destination = 2; });
    const r = openConflict(world, a, b); r.goodwill = 3;
    Object.assign(pair(world, c, d), { affinity: 40 });
    trigger(world, 'burst-pipe');
    for (const p of present(world).filter(p => p.trait !== 'practical')) expect(p.destination).toBe(0);
    expect(goodwill(r)).toBe(2.5);
    expect(pair(world, c, d).affinity).toBe(41);
    expect(pair(world, a, c).affinity).toBe(8);
    expect(world.history.at(-1)!.text).toContain('Open disagreements flare');
  });
  it('plans falling through put off peace offerings residents were about to make', () => {
    const world = house(); const [kind, practical] = present(world);
    openConflict(world, kind, practical);
    trigger(world, 'shared-meal');
    expect(world.pendingGestures).toHaveLength(1);
    applyCommand(world, { type: 'trigger-event', eventId: 'plans-fall-through' }, 100_000);
    expect(world.pendingGestures).toBeUndefined();
    expect(world.history.at(-1)!.text).toContain(`${kind.name} puts off going to find ${practical.name}`);
  });
});

describe('events that single someone out', () => {
  it('something going missing casts suspicion on whoever feels least at home; kind residents give the benefit of the doubt', () => {
    const world = house(); const [kind, practical, suspect, spirited, curious] = present(world);
    suspect.belonging = 10;
    trigger(world, 'missing-thing');
    expect(pair(world, kind, suspect).trust).toBe(28);
    expect(pair(world, practical, suspect).trust).toBe(24);
    expect(pair(world, spirited, curious).trust).toBe(29);
    expect(suspect.belonging).toBe(2);
    expect(world.history.at(-1)!.text).toContain(`drifting toward ${suspect.name}`);
  });
  it('someone left out loses belonging, and kind residents go to find them', () => {
    const world = house(); const [kind, practical, outsider] = present(world);
    outsider.belonging = 5; outsider.floor = outsider.destination = 2;
    trigger(world, 'left-out');
    expect(outsider.belonging).toBe(0);
    expect(pair(world, kind, outsider).affinity).toBe(13);
    expect(pair(world, practical, outsider).affinity).toBe(8);
    expect(kind.destination).toBe(2);
    expect(world.history.at(-1)!.text).toContain(`${outsider.name} is left off the list. ${kind.name} notices.`);
  });
  it('someone falling ill draws carers closer, and caring for someone you are at odds with is good faith', () => {
    const world = house(); const [kind, practical, reserved, spirited] = present(world);
    reserved.energy = 20; Object.assign(pair(world, spirited, reserved), { affinity: 30 });
    const r = openConflict(world, kind, reserved);
    trigger(world, 'someone-ill');
    expect(reserved.energy).toBe(0);
    expect(reserved.destination).toBe(1);
    for (const carer of [kind, practical, spirited]) expect(pair(world, carer, reserved).trust).toBe(33);
    expect(pair(world, present(world)[4], reserved).trust).toBe(30);
    expect(goodwill(r)).toBe(1.5);
    expect(world.history.at(-1)!.text).toContain(`${reserved.name} is the one in bed`);
  });
  it('a birthday surprise celebrates whoever feels least at home', () => {
    const world = house(); const [kind, , , , curious] = present(world);
    curious.belonging = 20;
    trigger(world, 'birthday-surprise');
    expect(curious.belonging).toBe(32);
    expect(pair(world, kind, curious).affinity).toBe(13);
    expect(world.history.at(-1)!.text).toContain(`The cake is for ${curious.name}`);
  });
});

describe('events that move the whole house in their own way', () => {
  it('a lean week hits the worn down hardest and ends the comfort of a recent gift', () => {
    const world = house(); const [kind, practical] = present(world);
    kind.energy = 30; world.reliefUntil = world.minute + 500;
    trigger(world, 'lean-week');
    expect(world.reliefUntil).toBeUndefined();
    expect(kind.stateChanges?.some(c => c.cause === 'A lean week: running on empty')).toBe(true);
    expect(practical.stateChanges?.some(c => c.cause === 'A lean week: running on empty')).toBe(false);
  });
  it('a sleepless night leaves the most tired snapping at each other', () => {
    const world = house(); const [a, b, c] = present(world);
    a.energy = b.energy = 30; c.energy = 90;
    trigger(world, 'sleepless-night');
    expect(pair(world, a, b).affinity).toBe(8);
    expect(pair(world, a, c).affinity).toBe(10);
    expect(world.history.at(-1)!.text).toContain('snapping at each other');
  });
  it('a house vote draws each side together, pushes the sides apart, and leaves winners and losers', () => {
    const world = house(4);
    trigger(world, 'house-vote');
    const people = present(world);
    const won = people.filter(p => p.stateChanges?.some(c => c.cause === 'A house vote: won the vote'));
    const lost = people.filter(p => p.stateChanges?.some(c => c.cause === 'A house vote: lost the vote'));
    expect([won.length, lost.length]).toEqual([2, 2]);
    expect(pair(world, won[0], won[1]).affinity).toBe(12);
    expect(pair(world, won[0], lost[0]).affinity).toBe(7);
    expect(world.history.at(-1)!.text).toContain('The motion carries');
  });
  it('an unexpected bill drains supplies, draws everyone a little closer and softens grudges', () => {
    const world = house(); const [a, b, c, d] = present(world);
    const r = openConflict(world, a, b);
    trigger(world, 'unexpected-bill');
    expect(pair(world, c, d)).toMatchObject({ affinity: 11, trust: 31 });
    expect(goodwill(r)).toBe(.5);
  });
});
