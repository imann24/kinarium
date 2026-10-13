import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, summarize } from '../src/simulation/engine';
import { HouseDetailsConflict } from '../src/simulation/house-details';
const command = { type: 'house-details' as const, name: '  New house  ', description: '  New introduction  ', expectedRevision: 0 };
describe('house details', () => {
  it('updates only metadata, preserving identity, settings and all simulation history', () => {
    const world = createWorld({ slug: 'stable-house', name: 'Old house' }, 1, 12);
    const before = structuredClone(world);
    applyCommand(world, command, 1);
    expect(world).toEqual({ ...before, name: 'New house', description: 'New introduction', detailsRevision: 1 });
    expect(summarize(world, true)).toMatchObject({ slug: before.slug, name: 'New house', description: 'New introduction', protected: true });
  });
  it('allows empty descriptions, rejects stale edits, and makes repeated saves idempotent', () => {
    const world = createWorld({ slug: 'house', name: 'Old' });
    applyCommand(world, command, 1);
    const saved = structuredClone(world);
    applyCommand(world, command, 1);
    expect(world).toEqual(saved);
    expect(() => applyCommand(world, { ...command, name: 'Stale' }, 1)).toThrow(HouseDetailsConflict);
    expect(world).toEqual(saved);
    applyCommand(world, { ...command, description: '', expectedRevision: 1 }, 1);
    expect(world.description).toBe('');
    expect(world.detailsRevision).toBe(2);
    expect(() => applyCommand(world, command, 1)).toThrow(HouseDetailsConflict);
  });
  it.each([{ name: '' }, { name: '   ' }, { name: 'x'.repeat(61) }, { name: null }, { description: 'x'.repeat(241) }, { description: null }, { expectedRevision: -1 }, { expectedRevision: 0.5 }, { expectedRevision: undefined }])('rejects invalid input atomically: %j', invalid => {
    const world = createWorld({ slug: 'house', name: 'Old' });
    const before = structuredClone(world);
    expect(() => applyCommand(world, { ...command, ...invalid } as typeof command, 1)).toThrow();
    expect(world).toEqual(before);
  });
  it('does not conflict with or overwrite independently changed simulation settings', () => {
    const world = createWorld({ slug: 'house', name: 'Old' });
    applyCommand(world, { type: 'settings', mode: 'persistent', populationCap: 30 }, 1);
    applyCommand(world, command, 1);
    expect(world.settings).toEqual({ mode: 'persistent', populationCap: 30 });
  });
});
