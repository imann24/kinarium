import { describe, expect, it } from 'vitest';
import { applyCommand, createCharacter, createWorld, step } from '../src/simulation/engine';
import { beginConversation, nearby } from '../src/simulation/conversations';
import { separateStandingResidents, MIN_STANDING_GAP } from '../src/simulation/standing';
import { residentStacks } from '../src/client/resident-stacks';
import { planBuildingMotion, residentPosition } from '../src/client/building-motion';

function fixture(count = 3, x = 40) {
  const world = createWorld({ slug: 'stacks', name: 'Stacks', populationCap: 40 }, 0, 42);
  while (world.characters.length < count) createCharacter(world);
  world.characters = world.characters.slice(0, count);
  for (const c of world.characters) Object.assign(c, { x, floor: 0, destination: 0, energy: 80, mood: 80, trait: 'kind' });
  return world;
}
function distinct(world: ReturnType<typeof fixture>) {
  const people = world.characters.filter(c => !c.away && !c.inElevator);
  for (const [i, a] of people.entries()) for (const b of people.slice(i + 1)) {
    if (a.floor === b.floor) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(MIN_STANDING_GAP - 1e-7);
  }
}
const points = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, x: 757, y: 236 }));

describe('standing positions', () => {
  it.each([2, 3, 40])('separates %i persisted residents deterministically and settles without jitter', count => {
    for (const x of [8, 40, 84]) {
      const world = fixture(count, x), copy = structuredClone(world);
      const saved = structuredClone({ history: world.history, relationships: world.relationships, seed: world.seed });
      separateStandingResidents(world); separateStandingResidents(copy);
      distinct(world); expect(copy).toEqual(world);
      expect({ history: world.history, relationships: world.relationships, seed: world.seed }).toEqual(saved);
      expect(world.characters.every(c => c.x >= 8 && c.x <= 84)).toBe(true);
      const settled = structuredClone(world);
      for (let i = 0; i < 20; i++) separateStandingResidents(world);
      expect(world).toEqual(settled);
    }
  });
  it('preserves nearby distinct positions, absent residents and cabin stacking', () => {
    const world = fixture(4);
    world.characters[1].x = 42; world.characters[2].away = true; world.characters[3].inElevator = true;
    const before = structuredClone(world); separateStandingResidents(world); expect(world).toEqual(before);
    applyCommand(world, { type: 'set-away', characterId: world.characters[2].id, away: false }, 0);
    distinct(world);
  });
  it('reserves arrival positions without changing existing relationship history', () => {
    const world = fixture(39, 8); separateStandingResidents(world);
    createCharacter(world); distinct(world);
  });
  it('keeps exact stacks and edge-of-range group conversations together', () => {
    for (const positions of [[40, 40, 40, 40], [40, 40, 60, 60], [8, 8, 8, 28], [64, 84, 84, 84]]) {
      const world = fixture(4);
      world.characters.forEach((c, i) => c.x = positions[i]);
      const entry = beginConversation(world, world.characters[0], world.characters[1], true);
      expect(entry.characters).toHaveLength(4);
      separateStandingResidents(world); distinct(world);
      for (const a of world.characters) for (const b of world.characters) expect(nearby(a, b)).toBe(true);
      step(world); expect(entry.conversation?.status).toBe('active'); distinct(world);
    }
  });
  it('boards a dense queue without deadlock, allows the cabin stack and separates exits', () => {
    const world = fixture(40, 94);
    world.characters.forEach(c => c.destination = 1);
    separateStandingResidents(world); distinct(world);
    const arrived = new Set<string>(); let sawCabinStack = false;
    for (let i = 0; i < 40; i++) {
      step(world);
      sawCabinStack ||= world.characters.filter(c => c.inElevator).length > 1;
      for (const c of world.characters) {
        if (!c.inElevator && c.floor === 1) arrived.add(c.id);
        expect(c.x).toBeGreaterThanOrEqual(8); expect(c.x).toBeLessThanOrEqual(94);
      }
      distinct(world);
    }
    expect(sawCabinStack).toBe(true); expect(arrived.size).toBe(40);
  });
  it('replays dense simulations exactly with bounded positions', () => {
    const world = fixture(40), copy = structuredClone(world);
    for (let i = 0; i < 500; i++) {
      step(world); step(copy); distinct(world);
      for (const c of world.characters) if (!c.inElevator) {
        expect(c.x).toBeGreaterThanOrEqual(8); expect(c.x).toBeLessThanOrEqual(c.destination === c.floor ? 84 : 94);
      }
    }
    expect(world).toEqual(copy);
  });
});

describe('visible stack counts', () => {
  it.each([2, 3])('counts %i residents only on the last painted sprite', count => {
    const p = points(count);
    expect([...residentStacks(p)]).toEqual([[p.at(-1)!.id, count - 1]]);
    expect([...residentStacks([...p].reverse())]).toEqual([[p[0].id, count - 1]]);
    expect([...residentStacks(p.slice(1))]).toEqual(count === 3 ? [[p[2].id, 1]] : []);
  });
  it('uses a tiny radial tolerance, excludes nearby people and never chains stacks', () => {
    expect(residentStacks([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: .3, y: .4 }]).get('b')).toBe(1);
    expect(residentStacks([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: .4, y: .4 }]).size).toBe(0);
    expect([...residentStacks([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: .4, y: 0 }, { id: 'c', x: .8, y: 0 }])]).toEqual([['c', 1]]);
  });
  it('counts rendered boarding, riding and delayed exit positions, not snapshot flags', () => {
    const world = fixture(3, 94); world.characters.forEach(c => c.destination = 1);
    let motion = planBuildingMotion(undefined, world, 0);
    world.characters.forEach(c => c.inElevator = true);
    motion = planBuildingMotion(motion, world, 100);
    const countsAt = (time: number) => residentStacks(world.characters.filter(c => !c.away).map(c => {
      const p = residentPosition(motion, c.id, time); return { id: c.id, x: p.x, y: 236 + (2 - p.floor) * 143 };
    }));
    expect(countsAt(800).get('c3')).toBe(2);
    world.minute += 2; world.elevatorFloor = 1; world.characters.forEach(c => c.floor = 1);
    motion = planBuildingMotion(motion, world, 4100);
    expect(countsAt(5500).get('c3')).toBe(2);
    world.minute += 2; world.characters.forEach(c => { c.inElevator = false; c.x = 84; });
    separateStandingResidents(world); motion = planBuildingMotion(motion, world, 5000);
    expect(countsAt(7000).get('c3')).toBe(2);
    expect(countsAt(8000).size).toBe(0);
  });
});
