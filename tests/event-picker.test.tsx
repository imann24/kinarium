import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/simulation/catalog';
import EventPicker, { EVENT_ICONS } from '../src/client/EventPicker';
import { countdown, eventEffects, eventWait, filterEvents, searchEvents } from '../src/client/event-effects';
import { eventBudget } from '../src/simulation/event-budget';

const byId = (id: string) => EVENTS.find(e => e.id === id)!;
const render = (overrides: Partial<Parameters<typeof EventPicker>[0]> = {}) => renderToStaticMarkup(<EventPicker events={EVENTS} disabled={false} onPick={() => {}} {...overrides}/>);
const eventButtons = (html: string) => html.match(/<button\b[^>]*data-event-id="[^"]*"[^>]*>/g) ?? [];
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
  it('filters by tone without dropping any events from the full catalog', () => {
    expect(filterEvents(EVENTS, 'all')).toHaveLength(EVENTS.length);
    expect(filterEvents(EVENTS, 'disruptive').every(e => e.tone === 'disruptive')).toBe(true);
    expect(['kind', 'mixed', 'disruptive'].flatMap(tone => filterEvents(EVENTS, tone as 'kind' | 'mixed' | 'disruptive'))).toHaveLength(EVENTS.length);
  });
  it('searches names, descriptions, displayed tones and changed effects with case-insensitive words', () => {
    expect(searchEvents(EVENTS, '  SHARED   meal ').map(event => event.id)).toEqual(['shared-meal']);
    expect(searchEvents(EVENTS, 'lopsided')).toEqual([]); // Journal-only text is not displayed on an option.
    expect(searchEvents(EVENTS, 'cupboards').map(event => event.id)).toEqual(['lean-week']);
    expect(searchEvents(EVENTS, 'gentle')).toEqual(filterEvents(EVENTS, 'kind'));
    expect(searchEvents(EVENTS, 'energy')).toEqual(EVENTS.filter(event => (event.energy ?? 0) !== 0));
    expect(searchEvents(EVENTS, 'supplies')).toEqual(EVENTS.filter(event => event.resources !== 0));
    expect(searchEvents(EVENTS, 'gentle energy').map(event => event.id)).toEqual(['quiet-day']);
    expect(searchEvents(filterEvents(EVENTS, 'disruptive'), 'gentle')).toEqual([]);
    expect(searchEvents(EVENTS, '   ')).toBe(EVENTS);
    expect(searchEvents(EVENTS, 'nothing-matches')).toEqual([]);
  });
  it('renders one direct event action with its description and effects for each available event', () => {
    const html = render();
    expect(eventButtons(html)).toHaveLength(EVENTS.length);
    expect(eventButtons(html).every(button => !button.includes('disabled'))).toBe(true);
    for (const event of EVENTS) {
      expect(html).toContain(`data-event-id="${event.id}"`);
      expect(html).toContain(event.name);
      expect(html).toContain(event.description);
    }
    const text = html.replace(/<[^>]*>/g, '');
    expect(text).toContain('Tension');
    expect(text).toContain('+14');
    expect(text).toContain('Energy');
    expect(text).toContain('+15');
    expect(html).toContain('aria-label="Search events"');
    expect(html).toContain('aria-pressed="true"');
  });
  it('keeps options readable while dispatch is disabled or disconnected', () => {
    for (const overrides of [{ disabled: true }, { connected: false }]) {
      const html = render(overrides);
      expect(eventButtons(html)).toHaveLength(EVENTS.length);
      expect(eventButtons(html).every(button => button.includes('disabled'))).toBe(true);
      expect(html).toContain('A shared meal');
      expect(html).toContain('aria-label="Search events"');
    }
  });
  it('renders only supplied server-supported events and handles an empty catalog', () => {
    const html = render({ events: [byId('care-package')] });
    expect(eventButtons(html)).toHaveLength(1);
    expect(html).toContain('An unexpected gift');
    expect(html).not.toContain('A shared meal');
    expect(eventButtons(render({ events: [] }))).toHaveLength(0);
  });
  it('works out the longest wait before the next event, from the world settling or a spent allowance', () => {
    const world = { readyAt: 30_000, total: 45_000 };
    expect(eventWait(60_000, world, eventBudget([], 60_000))).toBeUndefined();
    expect(eventWait(0, world, eventBudget([], 0))).toEqual({ reason: 'world', readyAt: 30_000, total: 45_000 });
    const spent = eventBudget([-100_000, -50_000, -10_000], 0);
    expect(eventWait(0, world, spent)).toEqual({ reason: 'allowance', readyAt: 200_000, total: 300_000 });
    expect(eventWait(0, { readyAt: 250_000, total: 45_000 }, spent)?.reason).toBe('world');
    expect(countdown(61_200)).toBe('1:02');
    expect(countdown(-1)).toBe('0:00');
  });
  it('blocks every dispatch and displays the deadline during world and allowance waits', () => {
    const wait = { reason: 'world' as const, readyAt: 32_000, total: 45_000 };
    for (const reason of ['world', 'allowance'] as const) {
      const html = render({ wait: { ...wait, reason }, now: 0 });
      expect(eventButtons(html)).toHaveLength(EVENTS.length);
      expect(eventButtons(html).every(button => button.includes('disabled'))).toBe(true);
      expect(html).toContain('0:32');
      expect(html).toContain('A shared meal');
    }
  });
});
