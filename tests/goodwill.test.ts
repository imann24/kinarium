import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, relationship, step, teaGuests } from '../src/simulation/engine';
import { advanceConversations, beginConversation } from '../src/simulation/conversations';
import { communityDrift } from '../src/simulation/community-state';
import { quietComfort } from '../src/simulation/companionship';
import { EASED_GOODWILL, SETTLE_DELAY, isEased } from '../src/simulation/goodwill';
import { repairScene } from '../src/simulation/repair';
import { residentDrift } from '../src/simulation/resident-state';
import { bondKind } from '../src/client/relationship-label';

function pair(seed = 42) {
  const world = createWorld({ slug: 'goodwill', name: 'Goodwill', populationCap: 2 }, 0, seed);
  const [a, b] = world.characters;
  a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
  a.energy = b.energy = a.mood = b.mood = 75;
  const r = relationship(world, a.id, b.id); r.trust = 5; r.affinity = -20;
  return { world, a, b, r };
}
function finish(world: ReturnType<typeof createWorld>) {
  for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); }
}
function quarrel() {
  const f = pair(); beginConversation(f.world, f.a, f.b, false); finish(f.world); return f;
}

describe('goodwill from honored choices', () => {
  it('raises readiness and the floor under it, so repeated respect makes acceptance likelier', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120; world.tension = 100;
    expect(repairScene(world, a, b, r, .1)?.repair.accepted).toBe(false);
    r.goodwill = 3;
    expect(repairScene(world, a, b, r, .1)?.repair.accepted).toBe(true);
  });
  it('counts asking first and honoring a request for space as a kept promise', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    const trust = r.trust, goodwill = r.goodwill!;
    world.minute += 120;
    const space = beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)!); finish(world);
    expect(space.conversation!.repair).toMatchObject({ phase: 'follow-through', accepted: false });
    expect(r.trust).toBe(trust + 2); expect(r.goodwill).toBe(goodwill + 2);
    expect(r.story!.perspectives[a.id].promisesKept).toBe(1);
    expect(r.unresolvedConflict).toBeDefined();
    expect(space.text).toContain('asked first, as promised');
  });
  it('makes later bids on the same disagreement easier to accept after space was given', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120; world.tension = 60;
    const roll = .2;
    expect(repairScene(world, a, b, r, roll)?.repair.accepted).toBe(false);
    beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)!); finish(world);
    world.minute += 360;
    expect(repairScene(world, a, b, r, roll)?.repair.accepted).toBe(true);
  });
  it('eases a disagreement at three goodwill and settles it after time and a good moment together', () => {
    const { world, a, b, r } = quarrel(); r.encounters = 3; a.trait = b.trait = 'reserved';
    r.goodwill = EASED_GOODWILL - 1; expect(isEased(r)).toBe(false); expect(bondKind(r)).toBe('strained');
    r.goodwill = EASED_GOODWILL; r.easedMinute = world.minute;
    expect(isEased(r)).toBe(true); expect(bondKind(r)).toBe('easing');
    // Goodwill makes cautious quiet company possible below the usual trust of 60.
    expect(quietComfort(a, b, Object.assign(r, { trust: 40, affinity: -10 }), world.minute + 240)).toBeGreaterThan(0);
    // Plenty of goodwill, so a flare-up along the way does not undo the easing.
    r.goodwill = 6; const easedAt = r.easedMinute!;
    const topic = r.unresolvedConflict!.topic;
    let settled = false;
    for (let i = 0; i < 2000 && !settled; i++) {
      a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0; a.inElevator = b.inElevator = false;
      a.energy = b.energy = a.mood = b.mood = 75; r.lastRepairMinute = world.minute;
      const id = world.nextLog; step(world);
      const entry = world.history.find(e => e.id >= id && e.text.includes('has settled'));
      if (entry) { settled = true; expect(world.minute - easedAt).toBeGreaterThanOrEqual(SETTLE_DELAY); expect(entry.text).toContain(topic.toLowerCase()); }
    }
    expect(settled).toBe(true);
    expect(r.unresolvedConflict).toBeUndefined();
    expect(r.repairedConflictId).toBeDefined(); expect(r.easedMinute).toBeUndefined();
  });
  it('waits longer after each refusal on the same disagreement', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120;
    for (const wait of [360, 720, 1440]) {
      beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)!); finish(world);
      world.minute += wait - 60; expect(repairScene(world, a, b, r, .99)).toBeUndefined();
      world.minute += 60; expect(repairScene(world, a, b, r, .99)).toBeDefined();
    }
  });
});

describe('a floor under a distressed house', () => {
  it('holds evening tea for two willing residents even when togetherness is low', () => {
    const world = createWorld({ slug: 'tea', name: 'Tea' }, 0, 7);
    world.cohesion = 5; world.tension = 90; world.minute = 1078;
    for (const c of world.characters) c.mood = 10;
    const [a, b] = world.characters; a.mood = b.mood = 40;
    expect(teaGuests(world, world.characters).map(c => c.id)).toEqual([a.id, b.id]);
    const belonging = a.belonging;
    step(world);
    expect(world.history.at(-1)?.text).toContain('share a pot of tea');
    expect(world.cohesion).toBeGreaterThan(5); expect(world.tension).toBeLessThan(90);
    expect(a.belonging).toBeGreaterThan(belonging - .1);
  });
  it('cools slowly while quarrels continue, faster once the house is calm, and never below 20', () => {
    const world = createWorld({ slug: 'calm', name: 'Calm' }, 0, 7);
    world.tension = 80; world.cohesion = 10; world.minute += 600;
    expect(communityDrift(world)).toMatchObject({ calm: true, settling: .05, gathering: .02 });
    world.history.push({ id: world.nextLog++, minute: world.minute - 60, kind: 'conflict', text: 'A quarrel.', characters: [] });
    expect(communityDrift(world)).toMatchObject({ calm: false, settling: .02, gathering: .005 });
    world.tension = 20.01; world.history.pop();
    expect(communityDrift(world).next.tension).toBe(20);
    world.resources = 10; world.tension = 80;
    expect(communityDrift(world).settling).toBe(0);
  });
  it('stops belonging from fading below a floor set by the most trusted tie', () => {
    const world = createWorld({ slug: 'floor', name: 'Floor' }, 0, 7);
    const [a, b] = world.characters;
    for (const r of Object.values(world.relationships)) r.trust = 0;
    relationship(world, a.id, b.id).trust = 50;
    a.belonging = 25.01;
    const drift = residentDrift(a, world);
    expect(drift.floor).toBe(25); expect(drift.next.belonging).toBe(25);
    a.belonging = 10; expect(residentDrift(a, world).next.belonging).toBe(10);
  });
  it('lets a gift relieve supply worries for a while without touching trust', () => {
    const world = createWorld({ slug: 'gift', name: 'Gift' }, 1_000, 7);
    const c = world.characters[0];
    const before = residentDrift(c, world).supplies;
    applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
    expect(residentDrift(c, world).supplies).toBe(before * 2);
    world.minute += 361;
    expect(residentDrift(c, world).supplies).toBe(before);
  });
});
