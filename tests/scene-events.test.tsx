import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SceneEvents from '../src/client/SceneEvents';
import { shuffleSceneEvents } from '../src/client/scene-event-selection';
import { EVENTS } from '../src/simulation/catalog';
import { eventBudget } from '../src/simulation/event-budget';

const render = (overrides: Partial<Parameters<typeof SceneEvents>[0]> = {}) => renderToStaticMarkup(<SceneEvents budget={eventBudget([], 0)} now={0} readyAt={0} disabled={false} onPick={() => {}} {...overrides}/>);
const disabledButtons = (html: string) => html.match(/<button[^>]*disabled=""/g)?.length ?? 0;
afterEach(() => vi.restoreAllMocks());
describe('stage event shortcuts', () => {
  it('uses only server-supported events and retains the complete picker link', () => {
    const html = render({ eventIds: ['care-package'] });
    expect(html).toContain('An unexpected gift');
    expect(html).not.toContain('A shared meal');
    expect(html.match(/data-event-id=/g)).toHaveLength(1);
    expect(html).toContain('href="#house-events"');
  });
  it('makes shuffle available during cooldowns, but disables it for zero or one supported event', () => {
    const shuffle = (html: string) => html.match(/<button[^>]*aria-label="Shuffle quick-access events"[^>]*>/)?.[0];
    expect(shuffle(render({ readyAt: 30_000, disabled: true }))).not.toContain('disabled');
    expect(shuffle(render({ eventIds: ['care-package'] }))).toContain('disabled');
    const empty = render({ eventIds: ['unknown'] });
    expect(shuffle(empty)).toContain('disabled');
    expect(empty).not.toContain('data-event-id=');
  });
  it('blocks shortcuts while disconnected or another command is pending', () => {
    expect(disabledButtons(render({ disabled: true }))).toBe(3);
  });
  it('shares the full picker’s house cooldown and personal allowance', () => {
    const settling = render({ readyAt: 30_000 });
    expect(disabledButtons(settling)).toBe(3);
    expect(settling).toContain('Settling');
    const exhausted = render({ budget: eventBudget([-100_000, -50_000, -10_000], 0) });
    expect(disabledButtons(exhausted)).toBe(3);
    expect(exhausted).toContain('Refills in');
    expect(disabledButtons(render({ now: 300_000, readyAt: 30_000, budget: eventBudget([-100_000, -50_000, -10_000], 0) }))).toBe(0);
  });
});

describe('random shortcut selection', () => {
  it('draws three unique choices without changing the catalog and reaches beyond its first three entries', () => {
    const original = EVENTS.map(event => event.id);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const next = shuffleSceneEvents(EVENTS);
    expect(next).toHaveLength(3);
    expect(new Set(next.map(event => event.id)).size).toBe(3);
    expect(next.some(event => !original.slice(0, 3).includes(event.id))).toBe(true);
    expect(EVENTS.map(event => event.id)).toEqual(original);
  });
  it('shows entirely fresh choices when enough are supported', () => {
    const previous = EVENTS.slice(0, 3);
    expect(shuffleSceneEvents(EVENTS, previous).every(event => !previous.includes(event))).toBe(true);
  });
  it('introduces every unseen choice before repeating events in a small server catalog', () => {
    const pool = EVENTS.slice(0, 4);
    const next = shuffleSceneEvents(pool, pool.slice(0, 3));
    expect(next).toHaveLength(3);
    expect(next[0]).toBe(pool[3]);
    expect(new Set(next).size).toBe(3);
  });
  it('changes order even when random sampling repeats the same two or three choices', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    for (const count of [2, 3]) {
      const pool = EVENTS.slice(0, count);
      const next = shuffleSceneEvents(pool, pool);
      expect(next).not.toEqual(pool);
      expect(new Set(next)).toEqual(new Set(pool));
    }
    expect(shuffleSceneEvents([])).toEqual([]);
    expect(shuffleSceneEvents(EVENTS.slice(0, 1))).toEqual(EVENTS.slice(0, 1));
  });
});
