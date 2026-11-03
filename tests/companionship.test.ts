import { describe, expect, it } from 'vitest';
import { createWorld, relationship, step } from '../src/simulation/engine';
import { advanceQuietCompanionship, QUIET_COOLDOWN, QUIET_DURATION, quietComfort } from '../src/simulation/companionship';
import { beginConversation } from '../src/simulation/conversations';
import { dialogueMemory } from '../src/simulation/dialogue-context';

function fixture() {
  const world = createWorld({ slug: 'quiet', name: 'Quiet', populationCap: 3 }, 0, 42);
  const [a, b, c] = world.characters;
  for (const person of world.characters) Object.assign(person, { x: 10, floor: 0, destination: 0, mood: 50, energy: 50, belonging: 30, trait: 'reserved' });
  c.away = true;
  const r = relationship(world, a.id, b.id);
  Object.assign(r, { encounters: 5, trust: 80, affinity: 40 });
  return { world, a, b, c, r };
}
function sit(world: ReturnType<typeof createWorld>, minutes = QUIET_DURATION) {
  advanceQuietCompanionship(world);
  for (let i = 0; i < minutes; i += 2) { world.minute += 2; advanceQuietCompanionship(world); }
}

describe('quiet companionship', () => {
  it('requires sustained proximity and records actual restoration, provenance and future recall', () => {
    const { world, a, b, r } = fixture();
    sit(world, QUIET_DURATION - 2);
    expect(a.belonging).toBe(30);
    world.minute += 2; advanceQuietCompanionship(world);
    expect(a.belonging).toBeGreaterThan(30); expect(b.energy).toBeGreaterThan(50);
    expect(world.tension).toBeLessThan(18);
    expect(r.trust).toBe(80); expect(r.affinity).toBe(40);
    const entry = world.history.at(-1)!;
    expect(entry.text).toContain('Trusted company');
    expect(a.stateChanges?.at(-1)?.belonging).toBe(a.belonging - 30);
    expect(world.communityChanges?.at(-1)?.eventId).toBe(entry.id);
    expect(world.communityChanges?.at(-1)?.tension).toBeLessThan(0);
    expect(a.memories[0].eventId).toBe(entry.id);
    expect(dialogueMemory(world, a, b)?.eventId).toBe(entry.id);
  });
  it('gives familiar residents less than trusted compatible pairs and nothing to strangers or hostile pairs', () => {
    const f = fixture(); const trusted = quietComfort(f.a, f.b, f.r, f.world.minute);
    Object.assign(f.r, { trust: 40, affinity: 5 });
    const familiar = quietComfort(f.a, f.b, f.r, f.world.minute);
    expect(familiar).toBeGreaterThan(0); expect(familiar).toBeLessThan(trusted);
    for (const relationshipState of [{ trust: 0, affinity: 80, encounters: 5 }, { trust: 80, affinity: -20, encounters: 5 }, { trust: 40, affinity: 5, encounters: 0 }]) {
      Object.assign(f.r, relationshipState); sit(f.world);
      expect(f.a.belonging).toBe(30);
    }
  });
  it('uses both residents’ temperament and mood rather than assuming silence is comfortable', () => {
    const { world, a, b, r } = fixture();
    const compatible = quietComfort(a, b, r, world.minute);
    b.trait = 'spirited'; expect(quietComfort(a, b, r, world.minute)).toBeLessThan(compatible);
    b.mood = 14; sit(world); expect(a.belonging).toBe(30);
  });
  it('allows only a small respite after cooling down without resolving conflict or changing trust', () => {
    const { world, a, r } = fixture();
    r.unresolvedConflict = { id: 99, minute: world.minute, topic: 'Sharing' };
    sit(world); expect(a.belonging).toBe(30);
    world.minute += 120; sit(world);
    expect(a.belonging).toBeGreaterThan(30); expect(a.belonging).toBeLessThan(31);
    expect(r.unresolvedConflict?.id).toBe(99); expect(r.repairedConflictId).toBeUndefined(); expect(r.trust).toBe(80);
    expect(a.memories[0].tone).toBe('neutral'); expect(world.history.at(-1)?.text).toContain('their disagreement is still open');
  });
  it.each(['distance', 'away', 'travel', 'conversation'] as const)('breaks the interval on %s', reason => {
    const { world, a, b } = fixture();
    sit(world, QUIET_DURATION - 2);
    if (reason === 'distance') b.x = 80;
    if (reason === 'away') b.away = true;
    if (reason === 'travel') b.destination = 1;
    if (reason === 'conversation') beginConversation(world, a, b, true);
    world.minute += 2; advanceQuietCompanionship(world);
    expect(a.belonging).toBe(30);
    if (reason !== 'conversation') {
      Object.assign(b, { x: 10, away: false, destination: 0 });
      world.minute += 2; sit(world, QUIET_DURATION - 2); expect(a.belonging).toBe(30);
    }
  });
  it('limits repeated rewards across partners, serialization and skipped time', () => {
    const { world, a, c } = fixture();
    c.away = false;
    Object.assign(relationship(world, a.id, c.id), { trust: 80, affinity: 40, encounters: 5 });
    sit(world);
    expect(a.stateChanges).toHaveLength(1); expect(c.belonging).toBe(30);
    const saved = JSON.parse(JSON.stringify(world)) as typeof world;
    sit(saved, QUIET_COOLDOWN - 2);
    expect(saved.characters[0].stateChanges).toHaveLength(1);
    saved.minute += 1000; advanceQuietCompanionship(saved);
    expect(saved.characters[0].stateChanges).toHaveLength(1);
    sit(saved); expect(saved.characters[0].stateChanges).toHaveLength(2);
  });
  it('occurs autonomously in the simulation rather than only through direct calls', () => {
    const { world } = fixture();
    for (let i = 0; i < 1440; i++) step(world);
    expect(world.history.some(e => e.kind === 'ritual' && e.text.includes('spend a quiet while'))).toBe(true);
  });
  it('does not turn an unobserved time jump into quiet time and respects bounded stats', () => {
    const { world, a } = fixture();
    advanceQuietCompanionship(world); world.minute += 1000; advanceQuietCompanionship(world);
    expect(a.stateChanges).toBeUndefined();
    a.mood = a.energy = a.belonging = 100; world.tension = .1;
    sit(world); expect(a.stateChanges?.[0]).toMatchObject({ mood: 0, energy: 0, belonging: 0 });
    expect(world.tension).toBe(0);
  });
});
