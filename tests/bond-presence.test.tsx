import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Bonds from '../src/client/Bonds';
import { communityInsights } from '../src/client/community-insights';
import { applyCommand, createWorld, relationship } from '../src/simulation/engine';

function fixture() {
  const world = createWorld({ slug: 'bond-presence', name: 'Bonds', populationCap: 3 }, 0, 42);
  Object.assign(relationship(world, 'c1', 'c2'), { encounters: 4, affinity: 50, trust: 72 });
  Object.assign(relationship(world, 'c1', 'c3'), { encounters: 2, affinity: -40, trust: 20 });
  return world;
}
const render = (world: ReturnType<typeof fixture>) => renderToStaticMarkup(<Bonds world={world} onSelect={() => {}}/>);
const count = (world: ReturnType<typeof fixture>) => (render(world).match(/class="bond-card"/g) ?? []).length;

describe('Bonds presence projection', () => {
  it.each(['c1', 'c2'])('hides either away endpoint (%s), restores on return, and preserves relationship data', id => {
    const world = fixture();
    const saved = structuredClone(world.relationships);
    expect(count(world)).toBe(2);
    applyCommand(world, { type: 'set-away', characterId: id, away: true }, 0);
    expect(count(world)).toBe(id === 'c1' ? 0 : 1);
    expect(world.relationships).toEqual(saved);
    applyCommand(world, { type: 'set-away', characterId: id, away: false }, 0);
    expect(count(world)).toBe(2);
    expect(world.relationships).toEqual(saved);
  });
  it('keeps both-away pairs hidden until both return, including restored snapshots', () => {
    let world = fixture();
    world.characters[0].away = world.characters[1].away = true;
    world = JSON.parse(JSON.stringify(world));
    expect(count(world)).toBe(0);
    world.characters[0].away = false;
    expect(count(world)).toBe(1);
    world.characters[1].away = false;
    expect(count(world)).toBe(2);
  });
  it('ignores missing endpoints and unmet pairs without deleting history or changing sort order', () => {
    const world = fixture();
    expect(render(world).indexOf('A budding friendship')).toBeLessThan(render(world).indexOf('A difficult connection'));
    world.characters = world.characters.filter(c => c.id !== 'c1');
    const before = structuredClone(world);
    expect(count(world)).toBe(0);
    expect(render(world)).toContain('No encounters between residents currently at home');
    expect(world).toEqual(before);
  });
  it('preserves Insights connection groups and its explicit historical scope', () => {
    const world = fixture(); world.characters[1].away = true;
    expect(communityInsights(world)).toMatchObject({ close: 0, strained: 1, forming: 0 });
    expect(communityInsights(world, 'all')).toMatchObject({ close: 1, strained: 1, forming: 0, notMet: 1 });
    world.characters[1].away = false;
    expect(communityInsights(world).close).toBe(1);
  });
});
