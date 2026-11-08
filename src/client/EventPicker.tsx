import { useRef, useState } from 'react';
import { Armchair, ArrowRight, BedDouble, CalendarX, Cake, Check, Clock3, Droplets, Gift, Handshake, HeartCrack, Megaphone, MessageCircle, Moon, PackageSearch, Receipt, Search, ShoppingBasket, Soup, Sprout, Thermometer, UserMinus, Vote, Wind, X, Zap } from 'lucide-react';
import type { EventDefinition } from '../simulation/catalog';
import { TONE_FILTERS, TONE_LABELS, countdown, eventEffects, filterEvents, searchEvents, type EventWait, type ToneFilter } from './event-effects';
import './event-picker.css';

export const EVENT_ICONS = {
  soup: Soup, gift: Gift, moon: Moon, sprout: Sprout, zap: Zap, message: MessageCircle, armchair: Armchair, handshake: Handshake, wind: Wind,
  droplets: Droplets, 'package-search': PackageSearch, megaphone: Megaphone, basket: ShoppingBasket, bed: BedDouble, 'heart-crack': HeartCrack,
  'user-minus': UserMinus, 'calendar-x': CalendarX, vote: Vote, receipt: Receipt, thermometer: Thermometer, cake: Cake,
};
const TONE_NOTES: Record<ToneFilter, string> = {
  all: 'Every kind of possibility', kind: 'Care, rest & connection', mixed: 'A change in the rhythm', disruptive: 'Put the house to the test',
};
type DispatchResult = { id: string; name: string; sent: boolean };

/** Every event is a direct action. Filters and search remain usable while the house settles. */
export default function EventPicker({ events, disabled, connected = true, wait, now = 0, onPick }: {
  events: EventDefinition[]; disabled: boolean; connected?: boolean; wait?: EventWait; now?: number;
  onPick: (id: string) => void | boolean | Promise<boolean | void>;
}) {
  const [tone, setTone] = useState<ToneFilter>('all');
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState<string>();
  const [result, setResult] = useState<DispatchResult>();
  const inFlight = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const shown = searchEvents(filterEvents(events, tone), query);
  const blocked = disabled || !connected || !!wait || !!sending;
  const status = !connected ? 'Reconnecting to the house…'
    : sending ? 'Sending your event…'
    : wait ? `${wait.reason === 'world' ? 'Let the house settle' : 'Your allowance is recharging'} · ${countdown(wait.readyAt - now)}`
    : disabled ? 'Finishing another change…' : 'Ready for the next moment';

  async function send(event: EventDefinition) {
    if (blocked || inFlight.current) return;
    inFlight.current = true;
    setSending(event.id);
    setResult(undefined);
    try {
      const sent = await onPick(event.id);
      // Only a server acknowledgement can announce success.
      if (typeof sent === 'boolean') setResult({ id: event.id, name: event.name, sent });
    } catch {
      setResult({ id: event.id, name: event.name, sent: false });
    } finally {
      inFlight.current = false;
      setSending(undefined);
    }
  }

  return <div className="event-picker">
    <div className="event-tone-index" role="group" aria-label="Show events by tone">
      {TONE_FILTERS.map(filter => <button key={filter.tone} type="button" className={`event-tone-choice ${filter.tone}`} aria-label={filter.tone === 'all' ? `All events, ${events.length}` : undefined} aria-pressed={tone === filter.tone} onClick={() => setTone(filter.tone)}>
        <span className="event-tone-label">{filter.tone !== 'all' && <i aria-hidden/>}{filter.label}<span>{filterEvents(events, filter.tone).length}</span></span>
        <small>{TONE_NOTES[filter.tone]}</small>
      </button>)}
      <p className="event-index-note">You set the scene.<br/>They take it from there.</p>
    </div>
    <div className="event-menu">
      <div className="event-menu-tools">
        <div className="event-menu-label"><h3>{tone === 'all' ? 'Choose a moment' : `${TONE_LABELS[tone]} events`}</h3><span role="status">{shown.length} {shown.length === 1 ? 'event' : 'events'}</span></div>
        <label className="event-search"><Search size={17} aria-hidden/><input ref={searchInput} type="search" aria-label="Search events" placeholder="Search events or effects" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button type="button" aria-label="Clear event search" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><X size={16} aria-hidden/></button>}</label>
      </div>
      <div className={`event-dispatch-status${blocked ? ' is-waiting' : ''}`}>
        <span>{blocked ? <Clock3 size={15} aria-hidden/> : <span className="event-ready-dot" aria-hidden/>}{status}</span>
        <span>One tap sends an event</span>
      </div>
      <div className={`event-dispatch-feedback${result && !result.sent ? ' is-error' : ''}`} role="status" aria-live="polite" aria-atomic="true">
        {result && (result.sent ? <><Check size={16} aria-hidden/><span><b>{result.name}</b> sent. Watch its story unfold in the journal.</span></> : <span><b>{result.name}</b> couldn’t be sent. {connected ? 'Try again when the house is ready.' : 'Wait for the house to reconnect, then try again.'}</span>)}
      </div>
      {shown.length ? <div className="event-options">{shown.map(event => {
        const Icon = EVENT_ICONS[event.icon as keyof typeof EVENT_ICONS] ?? Sprout;
        const sent = result?.id === event.id && result.sent && !!wait;
        const failed = result?.id === event.id && !result.sent;
        return <button type="button" key={event.id} data-event-id={event.id} className={`event-option ${event.tone}${sent ? ' is-sent' : ''}`} disabled={blocked} onClick={() => void send(event)}>
          <Icon className="event-option-icon" size={22} strokeWidth={1.6} aria-hidden/>
          <span className="event-option-copy"><span className="event-option-heading"><b>{event.name}</b><span className="event-option-tone">{TONE_LABELS[event.tone]}</span></span><span className="event-option-description">{event.description}{failed && <span className="event-option-error">Couldn’t send. Try again when the house is ready.</span>}</span>
            <span className="event-option-effects">{eventEffects(event).map(effect => <span key={effect.key} className={effect.good ? 'good' : 'bad'}>{effect.label} <strong>{effect.value > 0 ? '+' : '−'}{Math.abs(effect.value)}</strong></span>)}</span>
          </span>
          <span className="event-send">{sending === event.id ? 'Sending…' : sent ? <><Check size={14} aria-hidden/>Sent</> : failed ? <>Retry <ArrowRight size={15} aria-hidden/></> : <>Send <ArrowRight size={15} aria-hidden/></>}</span>
        </button>;
      })}</div> : <div className="event-empty"><Search size={26} strokeWidth={1.5} aria-hidden/><h4>{events.length ? 'No events match this search.' : 'No events are available in this house yet.'}</h4><p>{events.length ? 'Try a name, a feeling, or an effect like energy.' : 'The event menu will update when the house is ready.'}</p>{events.length > 0 && <button type="button" onClick={() => { setQuery(''); setTone('all'); }}>Show all events <ArrowRight size={15} aria-hidden/></button>}</div>}
      <p className="event-effects-note">Effects shown are starting changes. Residents may react differently.</p>
    </div>
  </div>;
}
