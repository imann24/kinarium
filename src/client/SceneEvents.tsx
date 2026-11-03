import { ArrowRight, Clock3, Sprout } from 'lucide-react';
import { EVENTS } from '../simulation/catalog';
import { EVENT_COOLDOWN_MS } from '../simulation/engine';
import { availableEvents, type PlayerEventBudget } from '../simulation/event-budget';
import { EVENT_ICONS } from './EventPicker';
import { countdown, eventWait, serverEvents } from './event-effects';

/** The same server availability and allowance rules as the complete event picker. */
export default function SceneEvents({ budget, now, readyAt, eventIds, disabled, onPick }: {
  budget: PlayerEventBudget; now: number; readyAt: number; eventIds?: string[];
  disabled: boolean; onPick: (id: string) => void;
}) {
  const wait = eventWait(now, { readyAt, total: EVENT_COOLDOWN_MS }, budget);
  const available = availableEvents(budget, now);
  const events = serverEvents(EVENTS, eventIds).slice(0, 3);
  return <section className="scene-events" aria-labelledby="scene-events-title">
    <div className="scene-events-heading"><h2 id="scene-events-title">Set the next scene</h2><span role="status">{wait ? <><Clock3 size={13}/>{wait.reason === 'world' ? 'Settling' : 'Refills in'} · {countdown(wait.readyAt - now)}</> : `${available} ${available === 1 ? 'event' : 'events'} available`}</span><a href="#house-events">All events <ArrowRight size={15}/></a></div>
    <div className="scene-event-options">{events.map(event => {
      const Icon = EVENT_ICONS[event.icon as keyof typeof EVENT_ICONS] ?? Sprout;
      return <button type="button" key={event.id} disabled={disabled || !!wait} onClick={() => onPick(event.id)} title={event.description}><Icon size={23} strokeWidth={1.6}/><span><b>{event.name}</b><small>{event.description}</small></span><ArrowRight size={16}/></button>;
    })}</div>
  </section>;
}
