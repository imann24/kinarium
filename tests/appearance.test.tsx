import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppearanceEditor } from '../src/client/AppearanceEditor';
import { Person } from '../src/client/Building';
import { HAIR_COLORS, HAIR_STYLES, residentAppearance, SKIN_TONES } from '../src/simulation/appearance';
import { COLORS } from '../src/simulation/catalog';
import { applyCommand, createWorld } from '../src/simulation/engine';

const fixture = () => createWorld({ slug: 'looks', name: 'Looks' }, 0, 42);
const person = (c: Parameters<typeof Person>[0]['character']) => renderToStaticMarkup(<svg><Person character={c}/></svg>);

describe('resident appearance', () => {
  it('keeps the id-based look for residents nobody has edited', () => {
    const [c1, c2, c3] = fixture().characters;
    expect(residentAppearance(c1)).toEqual({ skinTone: 1, hairStyle: 1, hairColor: 0 });
    expect(residentAppearance(c2)).toEqual({ skinTone: 0, hairStyle: 2, hairColor: 1 });
    expect(residentAppearance(c3)).toEqual({ skinTone: 0, hairStyle: 0, hairColor: 0 });
    expect(person(c1)).toContain(`fill="${SKIN_TONES[1]}"`);
    expect(person(c1)).toContain(`d="${HAIR_STYLES[1]}"`);
  });
  it('saves a chosen look on the resident and draws it', () => {
    const world = fixture(); const id = world.characters[0].id;
    applyCommand(world, { type: 'set-appearance', characterId: id, color: COLORS[5], appearance: { skinTone: 1, hairStyle: 2, hairColor: 1 } }, 0);
    const saved = JSON.parse(JSON.stringify(world)).characters[0];
    expect(saved.color).toBe(COLORS[5]);
    expect(saved.appearance).toEqual({ skinTone: 1, hairStyle: 2, hairColor: 1 });
    const html = person(saved);
    expect(html).toContain(`fill="${COLORS[5]}"`);
    expect(html).toContain(`fill="${SKIN_TONES[1]}"`);
    expect(html).toContain(`d="${HAIR_STYLES[2]}" fill="${HAIR_COLORS[1]}"`);
  });
  it.each([
    [{ color: '#000000', appearance: { skinTone: 0, hairStyle: 0, hairColor: 0 } }, 'clothing colors'],
    [{ color: COLORS[0], appearance: { skinTone: 2, hairStyle: 0, hairColor: 0 } }, 'skin tones'],
    [{ color: COLORS[0], appearance: { skinTone: 0, hairStyle: 1.5, hairColor: 0 } }, 'hair styles'],
    [{ color: COLORS[0], appearance: { skinTone: 0, hairStyle: 0, hairColor: -1 } }, 'hair colors'],
  ])('rejects looks outside the sprite options', (look, message) => {
    const world = fixture();
    expect(() => applyCommand(world, { type: 'set-appearance', characterId: 'c1', ...look }, 0)).toThrow(message);
    expect(world.characters[0].appearance).toBeUndefined();
  });
  it('marks the current choices in the editor', () => {
    const c = fixture().characters[1];
    const html = renderToStaticMarkup(<AppearanceEditor character={c} busy={false} onChange={() => {}}/>);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(4);
    expect(html).toContain('aria-label="Tufted" title="Tufted" aria-pressed="true"');
    expect(html).toContain('aria-label="Chestnut" title="Chestnut" aria-pressed="true"');
  });
});
