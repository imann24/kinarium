import type { EventDefinition, EventTone } from '../simulation/catalog';

export type EventView = 'deck' | 'grid';
export type ToneFilter = 'all' | EventTone;
export const EVENT_VIEW_KEY = 'kinarium:event-view';

export const TONE_LABELS: Record<EventTone, string> = { kind: 'Gentle', mixed: 'Mixed', disruptive: 'Disruptive' };
export const TONE_FILTERS: { tone: ToneFilter; label: string }[] = [
  { tone: 'all', label: 'All' },
  ...(Object.keys(TONE_LABELS) as EventTone[]).map(tone => ({ tone, label: TONE_LABELS[tone] })),
];

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
