import { useState } from 'react';
import { ArrowRight, Clock3, Shuffle, Sprout } from 'lucide-react';
import { EVENTS, type EventDefinition } from '../simulation/catalog';
import { EVENT_COOLDOWN_MS } from '../simulation/engine';
import { availableEvents, type PlayerEventBudget } from '../simulation/event-budget';
import { EVENT_ICONS } from './EventPicker';
import { countdown, eventWait, serverEvents } from './event-effects';
import { shuffleSceneEvents } from './scene-event-selection';

type SceneEventsProps = {
  budget: PlayerEventBudget; now: number; readyAt: number; eventIds?: string[];
  disabled: boolean; onPick: (id: string) => void;
};

/** Refresh on entry, a house event, or a server catalog change; countdown ticks keep choices stable. */
export default function SceneEvents(props: SceneEventsProps) {
  const events = serverEvents(EVENTS, props.eventIds);
  return <SceneEventTray key={JSON.stringify([props.readyAt, ...events.map(event => event.id)])} {...props} events={events}/>;
}

/** The same server availability and allowance rules as the complete event picker. */
function SceneEventTray({ budget, now, readyAt, disabled, onPick, events: pool }: SceneEventsProps & { events: EventDefinition[] }) {
  const [events, setEvents] = useState(() => shuffleSceneEvents(pool));
  const wait = eventWait(now, { readyAt, total: EVENT_COOLDOWN_MS }, budget);
  const available = availableEvents(budget, now);
  return <section className="scene-events" aria-labelledby="scene-events-title">
    <div className="scene-events-heading"><h2 id="scene-events-title">Set the next scene</h2><span role="status">{wait ? <><Clock3 size={13}/>{wait.reason === 'world' ? 'Settling' : 'Refills in'} · {countdown(wait.readyAt - now)}</> : `${available} ${available === 1 ? 'event' : 'events'} available`}</span><div className="scene-events-actions"><button type="button" aria-label="Shuffle quick-access events" title="Show a different selection of events" disabled={pool.length < 2} onClick={() => setEvents(previous => shuffleSceneEvents(pool, previous))}><Shuffle size={16} aria-hidden/>Shuffle</button><a href="#house-events">All events <ArrowRight size={15} aria-hidden/></a></div></div>
    <div className="scene-event-options" aria-live="polite" aria-atomic="true">{events.map(event => {
      const Icon = EVENT_ICONS[event.icon as keyof typeof EVENT_ICONS] ?? Sprout;
      return <button type="button" key={event.id} data-event-id={event.id} disabled={disabled || !!wait} onClick={() => onPick(event.id)} title={event.description}><Icon size={23} strokeWidth={1.6} aria-hidden/><span><b>{event.name}</b><small>{event.description}</small></span><ArrowRight size={16} aria-hidden/></button>;
    })}</div>
  </section>;
}
