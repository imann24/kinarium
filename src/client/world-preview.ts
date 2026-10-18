import type { Character, WorldState, WorldSummary } from '../simulation/types';

/**
 * A directory card's scene: the template example, peopled by the house's own
 * residents where they stood when it was last indexed. Older summaries without
 * residents keep the example's figures until the house next updates its entry.
 */
export function previewWorld(example: WorldState, summary: WorldSummary): WorldState {
  if (!summary.residents) return { ...example, name: summary.name };
  const characters = summary.residents.map(r => ({
    ...r, inElevator: !!r.inElevator, destination: r.x, activity: 'at home', away: false,
    trait: example.characters[0]?.trait, backstory: '', mood: 0, energy: 0, belonging: 0, memories: [],
  }) as Character);
  return { ...example, slug: summary.slug, name: summary.name, characters, elevatorFloor: summary.elevatorFloor ?? example.elevatorFloor };
}
