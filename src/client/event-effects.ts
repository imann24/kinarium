import type { EventDefinition, EventTone } from '../simulation/catalog';
import { availableEvents, type PlayerEventBudget } from '../simulation/event-budget';

export type EventView = 'deck' | 'grid';
export type ToneFilter = 'all' | EventTone;
export const EVENT_VIEW_KEY = 'kinarium:event-view';

export const TONE_LABELS: Record<EventTone, string> = { kind: 'Gentle', mixed: 'Mixed', disruptive: 'Disruptive' };
export const TONE_FILTERS: { tone: ToneFilter; label: string }[] = [
  { tone: 'all', label: 'All' },
  ...(Object.keys(TONE_LABELS) as EventTone[]).map(tone => ({ tone, label: TONE_LABELS[tone] })),
];

/** The client's events that the world's server also knows. A freshly shipped page can reach a house whose server is still on the previous release. */
export function serverEvents(events: EventDefinition[], serverIds?: readonly string[]): EventDefinition[] {
  if (!serverIds) return events;
  const known = new Set(serverIds);
  return events.filter(e => known.has(e.id));
}

export interface EventEffect { key: string; label: string; value: number; good: boolean }
const EFFECTS = [
  { key: 'cohesion', label: 'Togetherness' },
  { key: 'tension', label: 'Tension' },
  { key: 'resources', label: 'Supplies' },
  { key: 'mood', label: 'Mood' },
  { key: 'energy', label: 'Energy' },
] as const;

/** The house-wide numbers an event moves, largest first. Tension is the only one where a rise is bad. */
export function eventEffects(event: EventDefinition): EventEffect[] {
  return EFFECTS.map(({ key, label }) => ({ key, label, value: event[key] ?? 0 }))
    .filter(e => e.value !== 0)
    .map(e => ({ ...e, good: (e.value > 0) !== (e.key === 'tension') }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

export const filterEvents = (events: EventDefinition[], tone: ToneFilter) => tone === 'all' ? events : events.filter(e => e.tone === tone);

/** A saved choice wins; otherwise phones get the card deck and larger screens keep the grid. */
export function initialEventView(saved: string | null, phone: boolean): EventView {
  return saved === 'deck' || saved === 'grid' ? saved : phone ? 'deck' : 'grid';
}

/** Minutes and seconds left, as m:ss. */
export function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Why the event cards are resting, and until when: the world settling after the last event, or the player's allowance being spent. */
export interface EventWait { reason: 'world' | 'allowance'; readyAt: number; total: number }

/** The longest wait between now and the next event, or nothing when one could be introduced now. */
export function eventWait(now: number, world: { readyAt: number; total: number }, budget: PlayerEventBudget): EventWait | undefined {
  const waits: EventWait[] = [];
  if (world.readyAt > now) waits.push({ reason: 'world', ...world });
  const refill = budget.refillsAt.find(at => at > now);
  if (availableEvents(budget, now) === 0 && refill !== undefined) waits.push({ reason: 'allowance', readyAt: refill, total: budget.windowMs });
  return waits.sort((a, b) => b.readyAt - a.readyAt)[0];
}

/** How much of the wait is left, from 1 (just started) to 0 (ready). */
export const waitLeft = (wait: EventWait, now: number) => Math.max(0, Math.min(1, (wait.readyAt - now) / wait.total));
