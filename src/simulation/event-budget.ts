export const PLAYER_EVENT_LIMIT = 3;
export const PLAYER_EVENT_WINDOW_MS = 5 * 60_000;

export interface PlayerEventBudget {
  limit: number;
  windowMs: number;
  /** Server timestamps when consumed allowances become available again. */
  refillsAt: number[];
}

export function eventBudget(timestamps: number[], now: number): PlayerEventBudget {
  return {
    limit: PLAYER_EVENT_LIMIT,
    windowMs: PLAYER_EVENT_WINDOW_MS,
    refillsAt: timestamps.filter(at => at + PLAYER_EVENT_WINDOW_MS > now)
      .map(at => at + PLAYER_EVENT_WINDOW_MS).sort((a, b) => a - b),
  };
}

export function availableEvents(budget: PlayerEventBudget, now: number) {
  return Math.max(0, budget.limit - budget.refillsAt.filter(at => at > now).length);
}

export function consumeEvent(timestamps: number[], now: number): number[] {
  if (availableEvents(eventBudget(timestamps, now), now) === 0) throw new Error('Your event allowance is empty.');
  return [...timestamps.filter(at => at + PLAYER_EVENT_WINDOW_MS > now), now];
}
