import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/simulation/catalog';
import EventPicker, { EVENT_ICONS } from '../src/client/EventPicker';
import { countdown, eventEffects, eventWait, filterEvents, initialEventView, waitLeft } from '../src/client/event-effects';
import { eventBudget } from '../src/simulation/event-budget';

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
  it('works out the longest wait before the next event, from the world settling or a spent allowance', () => {
    const world = { readyAt: 30_000, total: 45_000 };
    expect(eventWait(60_000, world, eventBudget([], 60_000))).toBeUndefined();
    expect(eventWait(0, world, eventBudget([], 0))).toEqual({ reason: 'world', readyAt: 30_000, total: 45_000 });
    const spent = eventBudget([-100_000, -50_000, -10_000], 0);
    expect(eventWait(0, world, spent)).toEqual({ reason: 'allowance', readyAt: 200_000, total: 300_000 });
    expect(eventWait(0, { readyAt: 250_000, total: 45_000 }, spent)?.reason).toBe('world');
    expect(waitLeft({ reason: 'world', readyAt: 30_000, total: 45_000 }, 7_500)).toBe(0.5);
    expect(countdown(61_200)).toBe('1:02');
  });
  it('marks every card as resting, with the time left, while events are on cooldown', () => {
    const wait = { reason: 'world' as const, readyAt: 32_000, total: 45_000 };
    const deck = renderToStaticMarkup(<EventPicker events={EVENTS} disabled={false} phone wait={wait} now={0} onPick={() => {}}/>);
    expect(deck.match(/class="deck-card [^"]*waiting/g)).toHaveLength(EVENTS.length);
    expect(deck.match(/Settling · ready in 0:32/g)).toHaveLength(EVENTS.length);
    expect(deck).not.toContain('Introduce');
    expect(deck.match(/<button[^>]*class="deck-card[^"]*"[^>]*disabled/g)).toHaveLength(EVENTS.length);
    const grid = renderToStaticMarkup(<EventPicker events={EVENTS} disabled={false} phone={false} wait={{ ...wait, reason: 'allowance' }} now={0} onPick={() => {}}/>);
    expect(grid.match(/class="event-card [^"]*waiting/g)).toHaveLength(EVENTS.length);
    expect(grid).toContain('Allowance spent · back in 0:32');
    expect(grid).not.toContain('event-arrow');
  });
});
