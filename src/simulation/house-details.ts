import type { WorldState } from './types';

export class HouseDetailsConflict extends Error {
  constructor() { super('The house details changed in another session. Load the latest details before saving again.'); }
}

export function updateHouseDetails(world: WorldState, input: { name: string; description: string; expectedRevision: number }) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 60) throw new Error('House name must contain 1–60 characters.');
  if (typeof input.description !== 'string' || input.description.length > 240) throw new Error('Description must be no more than 240 characters.');
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error('Invalid house details revision.');
  const name = input.name.trim(), description = input.description.trim();
  const revision = world.detailsRevision ?? 0;
  // An immediate retry of an already applied save is harmless, including a lost response.
  if (revision === input.expectedRevision + 1 && world.name === name && world.description === description) return;
  if (revision !== input.expectedRevision) throw new HouseDetailsConflict();
  if (world.name === name && world.description === description) return;
  world.name = name;
  world.description = description;
  world.detailsRevision = revision + 1;
}
