import { createWorld, log, relationship } from '../../src/simulation/engine';
import type { WorldState } from '../../src/simulation/types';

/**
 * A long-running house in the state the field test found: no togetherness, full tension,
 * low belonging and trust, and several open disagreements. Supplies are fine.
 */
export function distressedHouse(seed: number): WorldState {
  const world = createWorld({ slug: `distressed-${seed}`, name: 'Distressed' }, 0, seed);
  Object.assign(world, { cohesion: 0, tension: 100, resources: 60 });
  for (const c of world.characters) Object.assign(c, { mood: 30, belonging: 10, energy: 70 });
  for (const r of Object.values(world.relationships)) Object.assign(r, { trust: 20, affinity: -15, encounters: 6, lastMinute: world.minute });
  const [a, b, c, d] = world.characters;
  for (const [x, y, topic] of [[a, b, 'Who cleans the kitchen'], [b, c, 'Noise after dark'], [c, d, 'The garden plan']] as const) {
    const conflict = log(world, 'conflict', `${x.name} works through a disagreement with ${y.name}.`, [x.id, y.id]);
    relationship(world, x.id, y.id).unresolvedConflict = { id: conflict.id, minute: world.minute, topic };
  }
  // The disagreements are hours old, as in a long-running house.
  world.minute += 240;
  return world;
}

/** A settled, ordinary house. */
export function healthyHouse(seed: number): WorldState {
  const world = createWorld({ slug: `healthy-${seed}`, name: 'Healthy' }, 0, seed);
  for (const r of Object.values(world.relationships)) Object.assign(r, { trust: 50, affinity: 20, encounters: 10, lastMinute: world.minute });
  return world;
}
