import { describe, expect, it } from 'vitest';
import { availableEvents, consumeEvent, eventBudget, PLAYER_EVENT_WINDOW_MS as WINDOW } from '../src/simulation/event-budget';

describe('per-player event budget', () => {
  it('allows three events and rejects a fourth in the rolling window', () => {
    let uses: number[] = [];
    for (const now of [1_000, 46_000, 91_000]) uses = consumeEvent(uses, now);
    expect(availableEvents(eventBudget(uses, 136_000), 136_000)).toBe(0);
    expect(() => consumeEvent(uses, 136_000)).toThrow('empty');
  });
  it('replenishes individually at the exact five-minute boundary without a reset burst', () => {
    const uses = [1_000, 46_000, 91_000];
    expect(availableEvents(eventBudget(uses, WINDOW + 999), WINDOW + 999)).toBe(0);
    const budget = eventBudget(uses, WINDOW + 1_000);
    expect(availableEvents(budget, WINDOW + 1_000)).toBe(1);
    expect(budget.refillsAt).toEqual([WINDOW + 46_000, WINDOW + 91_000]);
    expect(consumeEvent(uses, WINDOW + 1_000)).toEqual([46_000, 91_000, WINDOW + 1_000]);
  });
  it('can update a client countdown from server deadlines without another snapshot', () => {
    const budget = eventBudget([1_000, 46_000, 91_000], 91_000);
    expect(availableEvents(budget, WINDOW + 1_000)).toBe(1);
    expect(availableEvents(budget, WINDOW + 46_000)).toBe(2);
    expect(availableEvents(budget, WINDOW + 91_000)).toBe(3);
  });
  it('starts empty history with full allowance and preserves saved timestamps', () => {
    expect(availableEvents(eventBudget([], 0), 0)).toBe(3);
    const uses = [1_000, 46_000]; const restored = JSON.parse(JSON.stringify(uses));
    expect(eventBudget(restored, 100_000)).toEqual(eventBudget(uses, 100_000));
    eventBudget(uses, WINDOW * 2); expect(uses).toEqual([1_000, 46_000]);
  });
});
