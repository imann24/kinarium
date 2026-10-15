import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, step } from '../src/simulation/engine';
import { recordResidentChange, residentDrift, residentStats } from '../src/simulation/resident-state';

describe('resident state attribution', () => {
  it('uses the same ongoing calculation as the engine, including bounds and post-decay belonging', () => {
    for (const minute of [0, 358, 360, 480, 1320, 1322]) for (const floor of [0, 1, 2]) for (const value of [0, 35, 100]) {
      const world = createWorld({ slug: 'test', name: 'Test', populationCap: 1 }, 0, 42);
      const c = world.characters[0]; Object.assign(c, { floor, mood: value, energy: value, belonging: value });
      world.minute = minute; world.resources = 4; world.tension = 100;
      const expected = residentDrift(c, { ...world, minute: minute + 2 });
      step(world);
      expect(residentStats(c)).toEqual(expected.next);
      expect(c.stateChanges).toBeUndefined();
    }
  });
  it('separates full energy from mood pressure and exposes saturation', () => {
    const world = createWorld({ slug: 'test', name: 'Test' });
    const c = world.characters[0]; Object.assign(c, { mood: 0, energy: 100, belonging: 19, floor: 1 });
    world.resources = 4; world.tension = 100;
    const drift = residentDrift(c, world);
    expect(drift.next.mood).toBe(0); expect(drift.supplies + drift.connection + drift.tension).toBeLessThan(0);
    expect(drift.energy).toBe(1.8); expect(drift.next.energy).toBe(100);
    c.energy = 0; expect(residentDrift(c, world).next.mood).toBe(drift.next.mood);
  });
  it('records only actual event effects and participants, and survives save/load', () => {
    const world = createWorld({ slug: 'test', name: 'Test' }, 0);
    const [c, away] = world.characters; c.mood = 99; away.away = true;
    const before = residentStats(c);
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1000);
    const change = c.stateChanges![0];
    expect(change.mood).toBe(c.mood - before.mood); expect(change.mood).toBe(1);
    expect(change.energy).toBe(0); expect(change.belonging).toBe(0);
    expect(world.history.find(e => e.id === change.eventId)?.characters).toContain(c.id);
    expect(away.stateChanges).toBeUndefined();
    expect(JSON.parse(JSON.stringify(world)).characters[0].stateChanges).toEqual(c.stateChanges);
  });
  it('records warm and tense encounter effects with their actual event IDs', () => {
    const world = createWorld({ slug: 'test', name: 'Test' }, 0, 42);
    world.tension = 70; world.resources = 10;
    const observed = new Map<string, NonNullable<typeof world.characters[number]['stateChanges']>[number]>();
    for (let i = 0; i < 720; i++) {
      step(world);
      for (const resident of world.characters) for (const change of resident.stateChanges ?? []) observed.set(`${resident.id}:${change.eventId}`, change);
    }
    const changes = [...observed.values()];
    expect(changes.some(c => c.cause.startsWith('Warm encounter'))).toBe(true);
    expect(changes.some(c => c.cause.startsWith('Disagreement'))).toBe(true);
    for (const c of changes) {
      expect(world.history.some(e => e.id === c.eventId && e.minute === c.minute)).toBe(true);
      expect(c.energy).toBe(0);
      expect(c.cause.startsWith('Warm') ? c.mood >= 0 && c.belonging >= 0 : c.mood <= 0 && c.belonging <= 0).toBe(true);
    }
  });
  it('bounds records, keeps zero effects honest and leaves away stats paused', () => {
    const world = createWorld({ slug: 'test', name: 'Test' }); const c = world.characters[0];
    for (let i = 0; i < 20; i++) recordResidentChange(c, residentStats(c), i, 'At limit', i);
    expect(c.stateChanges).toHaveLength(8); expect(c.stateChanges![0].eventId).toBe(12);
    expect(c.stateChanges![0].mood).toBe(0);
    c.away = true; expect(residentDrift(c, world).next).toEqual(residentStats(c));
  });
});
