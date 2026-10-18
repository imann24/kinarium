import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/simulation/catalog';
import EventPicker, { EVENT_ICONS } from '../src/client/EventPicker';
import { eventEffects, filterEvents, initialEventView } from '../src/client/event-effects';

const byId = (id: string) => EVENTS.find(e => e.id === id)!;
describe('event picker', () => {
  it('has an icon from the app’s icon set for every event', () => {
    for (const e of EVENTS) expect(EVENT_ICONS).toHaveProperty(e.icon);
  });
  it('lists what an event moves, largest first, with tension the only rise that is bad', () => {
    expect(eventEffects(byId('shouting-match'))).toEqual([
      { key: 'tension', label: 'Tension', value: 14, good: false },
      { key: 'cohesion', label: 'Togetherness', value: -5, good: false },
      { key: 'mood', label: 'Mood', value: -5, good: false },
    ]);
    expect(eventEffects(byId('quiet-day'))[0]).toEqual({ key: 'energy', label: 'Energy', value: 15, good: true });
    expect(eventEffects(byId('shared-meal')).find(e => e.key === 'tension')).toMatchObject({ value: -7, good: true });
  });
  it('filters by tone and defaults to the deck on phones and the grid elsewhere, unless the player chose', () => {
    expect(filterEvents(EVENTS, 'all')).toHaveLength(EVENTS.length);
    expect(filterEvents(EVENTS, 'disruptive').every(e => e.tone === 'disruptive')).toBe(true);
    expect(initialEventView(null, true)).toBe('deck');
    expect(initialEventView(null, false)).toBe('grid');
    expect(initialEventView('deck', false)).toBe('deck');
    expect(initialEventView('grid', true)).toBe('grid');
    expect(initialEventView('nonsense', true)).toBe('deck');
  });
  it('renders the deck on phones with one button per event, its tone and effects, and a layout toggle', () => {
    const html = renderToStaticMarkup(<EventPicker events={EVENTS} disabled={false} phone onPick={() => {}}/>);
    expect(html.match(/class="deck-card /g)).toHaveLength(EVENTS.length);
    expect(html).toContain('Tension +14');
    expect(html).toContain('aria-label="Card deck"');
    expect(html).toMatch(/aria-pressed="true" aria-label="Card deck"/);
    expect(html).toContain('1 of 24');
    expect(html).not.toContain('event-grid');
  });
  it('keeps the original grid as the default on larger screens', () => {
    const html = renderToStaticMarkup(<EventPicker events={EVENTS} disabled phone={false} onPick={() => {}}/>);
    expect(html.match(/class="event-card /g)).toHaveLength(EVENTS.length);
    expect(html).toMatch(/aria-pressed="true" aria-label="Grid"/);
    expect(html).not.toContain('deck-card');
  });
});
