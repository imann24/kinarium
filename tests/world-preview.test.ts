import { describe, expect, it } from 'vitest';
import { previewWorld } from '../src/client/world-preview';
import { applyCommand, createWorld, summarize } from '../src/simulation/engine';

const example = createWorld({ slug: 'example', name: 'A little world' }, 0, 125);

describe('directory previews', () => {
  it('draws the house’s own residents with their chosen looks', () => {
    const world = createWorld({ slug: 'duo', name: 'Duo' }, 0, 7);
    const [first, second, ...rest] = world.characters;
    for (const c of rest) applyCommand(world, { type: 'set-away', characterId: c.id, away: true }, 0);
    const look = { skinTone: 1, hairStyle: 2, hairColor: 1 };
    applyCommand(world, { type: 'set-appearance', characterId: first.id, color: second.color, appearance: look }, 0);
    const summary = summarize(world, false);
    expect(summary.residents?.map(r => r.id)).toEqual([first.id, second.id]);
    const preview = previewWorld(example, summary);
    expect(preview.slug).toBe('duo');
    expect(preview.characters).toHaveLength(2);
    expect(preview.characters[0]).toMatchObject({ id: first.id, name: first.name, color: second.color, appearance: look, floor: first.floor, away: false });
  });

  it('keeps the example figures for summaries indexed before previews existed', () => {
    const { residents: _, ...legacy } = summarize(createWorld({ slug: 'old', name: 'Old' }, 0, 9), false);
    const preview = previewWorld(example, legacy);
    expect(preview.characters).toBe(example.characters);
    expect(preview.name).toBe('Old');
  });
});
