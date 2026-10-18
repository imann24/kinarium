import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, log, relationship, step } from '../src/simulation/engine';
import { advanceConversations } from '../src/simulation/conversations';
import { EVENTS, eventDefinition } from '../src/simulation/catalog';
import { EVENT_REACTIONS, GESTURE_WINDOW, advanceGestures } from '../src/simulation/event-reactions';
import type { Trait, WorldState } from '../src/simulation/types';

const TRAITS: Trait[] = ['kind', 'practical', 'reserved', 'spirited', 'curious'];

function house(seed = 3) {
  const world = createWorld({ slug: 'events', name: 'Events', populationCap: 5 }, 0, seed);
  world.characters.forEach((c, i) => Object.assign(c, { trait: TRAITS[i], mood: 60, energy: 70, floor: 0, destination: 0, x: 10 + i * 4, inElevator: false }));
  return world;
}
/** An open disagreement between the first two residents, with the kind one first. */
function atOdds(world: WorldState) {
  // The curious resident has no event errand that takes them elsewhere.
  const [kind, other] = [world.characters[0], world.characters[4]];
  const conflict = log(world, 'conflict', `${kind.name} works through a disagreement with ${other.name}.`, [kind.id, other.id]);
  const r = relationship(world, kind.id, other.id);
  Object.assign(r, { trust: 30, affinity: -5, encounters: 4, unresolvedConflict: { id: conflict.id, minute: world.minute, topic: 'The garden plan' } });
  return { kind, other, r };
}
const lastOf = (world: WorldState, test: (e: WorldState['history'][number]) => boolean) => [...world.history].reverse().find(test);
function finish(world: WorldState) {
  for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); }
}

describe('personal consequences from house events', () => {
  it('gives each temperament its own response, remembered and attributed to the event', () => {
    const world = house();
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1_000);
    const occasion = lastOf(world, e => e.kind === 'event')!;
    for (const c of world.characters) {
      const reaction = EVENT_REACTIONS[c.trait].gathering!;
      expect(c.stateChanges?.some(change => change.cause === `A shared meal: ${reaction.label}` && change.eventId === occasion.id)).toBe(true);
      expect(c.memories.find(m => m.eventId === occasion.id)?.text).toContain(reaction.memory);
    }
    const reserved = world.characters.find(c => c.trait === 'reserved')!;
    expect(reserved.energy).toBe(64);
    expect(occasion.text).toContain(`${world.characters[0].name} made sure everyone had a seat`);
    // The journal text grows, but the event is still recognized for conversations and summaries.
    expect(eventDefinition(occasion)?.id).toBe('shared-meal');
  });
  it('lets residents who are struggling keep to themselves at a gathering', () => {
    const world = house(); const low = world.characters[1]; low.mood = 10;
    applyCommand(world, { type: 'trigger-event', eventId: 'story-night' }, 1_000);
    expect(low.stateChanges?.at(-1)?.cause).toBe('Stories after dark: kept to themselves');
    expect(lastOf(world, e => e.kind === 'event')!.text).not.toContain('kept to themselves');
  });
  it('lets practical and kind residents soften a disruption through what they do', () => {
    const world = house(); world.tension = 30;
    applyCommand(world, { type: 'trigger-event', eventId: 'power-outage' }, 1_000);
    // Event +12; practical −1 and kind −0.5 from their actions; spirited +0.5.
    expect(world.tension).toBe(30 + 12 - 1 - .5 + .5);
    expect(world.communityChanges?.at(-1)?.cause).toBe('The lights go out: residents’ responses');
    const practical = world.characters.find(c => c.trait === 'practical')!;
    expect(practical.destination).toBe(2);
  });
  it('turns material relief into supplies put away, not trust', () => {
    const world = house(); const resources = world.resources;
    const trust = Object.values(world.relationships).map(r => r.trust);
    applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
    expect(world.resources).toBe(Math.min(100, resources + 22 + 2));
    expect(Object.values(world.relationships).map(r => r.trust)).toEqual(trust);
  });
});

describe('peace offerings after a house event', () => {
  it('has a kind resident decide to make an offering, then give it when they meet', () => {
    const world = house(); const { kind, other, r } = atOdds(world);
    applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
    expect(world.pendingGestures).toEqual([expect.objectContaining({ fromId: kind.id, toId: other.id, conflictId: r.unresolvedConflict!.id, eventName: 'An unexpected gift' })]);
    expect(lastOf(world, e => e.kind === 'event')!.text).toContain(`${kind.name} goes looking for ${other.name}`);
    const trust = r.trust;
    advanceGestures(world, () => 0);
    const offering = lastOf(world, e => e.conversation?.repair?.phase === 'gesture')!;
    expect(offering.characters).toEqual([kind.id, other.id]);
    expect(offering.conversation!.turns[0].text).toContain('the garden plan');
    expect(world.pendingGestures).toBeUndefined();
    finish(world);
    expect(r.trust).toBe(trust + 1); expect(r.goodwill).toBe(1);
    expect(r.unresolvedConflict).toBeDefined();
    expect(offering.text).toContain('offering is accepted');
    expect(r.story!.perspectives[kind.id].repairsOffered).toBe(1);
  });
  it('still counts a declined offering a little, without trust, and leaves repair timing alone', () => {
    const world = house(); const { r } = atOdds(world);
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1_000);
    const trust = r.trust;
    advanceGestures(world, () => .99); finish(world);
    expect(r.trust).toBe(trust); expect(r.goodwill).toBe(.5);
    expect(r.lastRepairMinute).toBeUndefined(); expect(r.repairRefusals).toBeUndefined();
  });
  it('lets anyone with goodwill reach out, but not residents with nothing between them', () => {
    const world = house(); const { r } = atOdds(world);
    world.characters[0].trait = 'curious';
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1_000);
    expect(world.pendingGestures).toBeUndefined();
    r.goodwill = 2;
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 100_000);
    expect(world.pendingGestures).toHaveLength(1);
  });
  it('does not plan offerings after disruptions', () => {
    const world = house(); atOdds(world);
    applyCommand(world, { type: 'trigger-event', eventId: 'rumor' }, 1_000);
    expect(world.pendingGestures).toBeUndefined();
  });
  it('drops an offering that waited too long or whose disagreement changed', () => {
    for (const change of ['late', 'settled'] as const) {
      const world = house(); const { other, r } = atOdds(world);
      applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
      other.floor = other.destination = 1;
      advanceGestures(world, () => 0);
      expect(world.pendingGestures).toHaveLength(1);
      if (change === 'late') world.minute += GESTURE_WINDOW + 2; else r.unresolvedConflict = undefined;
      advanceGestures(world, () => 0);
      expect(world.pendingGestures).toBeUndefined();
    }
  });
  it('is part of the simulation step and gives distressed houses another way back after a gift', () => {
    let offerings = 0, accepted = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const world = house(seed); atOdds(world);
      applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
      for (let i = 0; i < 200; i++) step(world);
      const gesture = world.history.find(e => e.conversation?.repair?.phase === 'gesture' && e.conversation.status === 'finished');
      if (gesture) { offerings++; if (gesture.conversation!.repair!.accepted) accepted++; }
    }
    console.log('Offerings given after a gift:', offerings, '/ 20, accepted:', accepted);
    expect(offerings).toBeGreaterThanOrEqual(15); expect(accepted).toBeGreaterThan(0);
  });
});

describe('event definitions', () => {
  it('give every event a relational kind', () => {
    for (const e of EVENTS) expect(['gathering', 'relief', 'neutral', 'strain', 'rest', 'pairing', 'airing', 'crowding', 'suspicion', 'quarrel', 'scarcity', 'sleepless', 'betrayal', 'exclusion', 'letdown', 'faction', 'hardship', 'care', 'honor']).toContain(e.relational);
  });
});
