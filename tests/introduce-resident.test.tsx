import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import IntroduceResidentButton from '../src/client/IntroduceResidentButton';
import { createWorld } from '../src/simulation/engine';

const fixture = () => createWorld({ slug: 'capacity', name: 'Capacity', populationCap: 3 }, 0, 42);
const render = (world: ReturnType<typeof fixture>, pending = false, sidebar = false) =>
  renderToStaticMarkup(<IntroduceResidentButton world={world} pending={pending} sidebar={sidebar} onClick={() => {}}/>);

describe('introduction capacity explanation', () => {
  it.each([false, true])('keeps the button disabled with a focusable, described wrapper (sidebar=%s)', sidebar => {
    const html = render(fixture(), false, sidebar);
    expect(html).toContain('disabled=""');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('role="group"');
    const id = html.match(/aria-describedby="([^"]+)"/)![1];
    expect(html).toContain(`id="${id}" role="tooltip"`);
    expect(html).toContain('hidden=""');
    expect(html).toContain('This house is full. The population limit is 3 residents.');
  });
  it('uses the current configured cap, including over-capacity snapshots', () => {
    const world = fixture();
    world.settings.populationCap = 2;
    expect(render(world)).toContain('The population limit is 2 residents.');
    expect(render(world)).toContain('disabled=""');
  });
  it('counts only residents at home and removes the explanation when space opens', () => {
    const world = fixture();
    world.characters[0].away = true;
    for (const sidebar of [false, true]) {
      const html = render(world, false, sidebar);
      expect(html).not.toContain('disabled=');
      expect(html).not.toContain('tooltip');
      expect(html).not.toContain('aria-describedby');
      expect(html).not.toContain('tabindex');
    }
    world.characters[0].away = false;
    expect(render(world)).toContain('role="tooltip"');
  });
  it('preserves pending disablement without a misleading capacity tooltip', () => {
    const world = fixture(); world.settings.populationCap = 7;
    expect(render(world, true)).toContain('disabled=""');
    expect(render(world, true)).not.toContain('tooltip');
    expect(render(world)).not.toContain('disabled=');
  });
});
