import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Armchair, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BedDouble, CalendarX, Cake, Droplets, GalleryHorizontalEnd, Gift, Handshake, HeartCrack, LayoutGrid, Megaphone, MessageCircle, Moon, PackageSearch, Receipt, ShoppingBasket, Shuffle, Soup, Sprout, Thermometer, UserMinus, Vote, Wind, Zap } from 'lucide-react';
import type { EventDefinition } from '../simulation/catalog';
import { EVENT_VIEW_KEY, TONE_FILTERS, TONE_LABELS, eventEffects, filterEvents, initialEventView, type EventView, type ToneFilter } from './event-effects';
import './event-picker.css';

export const EVENT_ICONS = {
  soup: Soup, gift: Gift, moon: Moon, sprout: Sprout, zap: Zap, message: MessageCircle, armchair: Armchair, handshake: Handshake, wind: Wind,
  droplets: Droplets, 'package-search': PackageSearch, megaphone: Megaphone, basket: ShoppingBasket, bed: BedDouble, 'heart-crack': HeartCrack,
  'user-minus': UserMinus, 'calendar-x': CalendarX, vote: Vote, receipt: Receipt, thermometer: Thermometer, cake: Cake,
};
const iconFor = (event: EventDefinition) => EVENT_ICONS[event.icon as keyof typeof EVENT_ICONS] ?? Sprout;

function savedView() {
  try { return localStorage.getItem(EVENT_VIEW_KEY); } catch { return null; /* Storage may be unavailable, or this is a server render. */ }
}

/**
 * The player-triggered events, as a swipeable card deck (the default on phones) or the original
 * grid. Either way one tap introduces an event; the deck also shows what each one moves.
 */
export default function EventPicker({ events, disabled, phone, onPick }: { events: EventDefinition[]; disabled: boolean; phone: boolean; onPick: (id: string) => void }) {
  // An explicit choice sticks; until then the layout follows the screen.
  const [saved, setSaved] = useState(savedView);
  const view = initialEventView(saved, phone);
  const [tone, setTone] = useState<ToneFilter>('all');
  const shown = filterEvents(events, tone);
  const choose = (next: EventView) => { setSaved(next); try { localStorage.setItem(EVENT_VIEW_KEY, next); } catch { /* Storage may be unavailable. */ } };
  return <div className={`event-picker ${view}`}>
    <div className="event-toolbar">
      <div className="event-filters" role="group" aria-label="Show events by tone">
        {TONE_FILTERS.map(f => <button key={f.tone} type="button" aria-pressed={tone === f.tone} onClick={() => setTone(f.tone)}>{f.label}<span>{filterEvents(events, f.tone).length}</span></button>)}
      </div>
      <div className="event-view-toggle" role="group" aria-label="Event layout">
        <button type="button" aria-pressed={view === 'deck'} aria-label="Card deck" title="Card deck" onClick={() => choose('deck')}><GalleryHorizontalEnd size={16} strokeWidth={1.6}/></button>
        <button type="button" aria-pressed={view === 'grid'} aria-label="Grid" title="Grid" onClick={() => choose('grid')}><LayoutGrid size={16} strokeWidth={1.6}/></button>
      </div>
    </div>
    {view === 'deck'
      ? <EventDeck key={tone} events={shown} disabled={disabled} onPick={onPick}/>
      : <div className="event-grid">{shown.map(event => { const Icon = iconFor(event); return <button key={event.id} data-event-id={event.id} className={`event-card ${event.tone}`} title={event.description} disabled={disabled} onClick={() => onPick(event.id)}><span className="event-icon"><Icon size={20} strokeWidth={1.5}/></span><b>{event.name}</b><small>{event.description}</small><ArrowUpRight size={14} className="event-arrow"/></button>; })}</div>}
  </div>;
}

function EventDeck({ events, disabled, onPick }: { events: EventDefinition[]; disabled: boolean; onPick: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [drawn, setDrawn] = useState<string>();
  const cards = () => [...(track.current?.children ?? [])] as HTMLElement[];
  // The card nearest the middle of the track is the one in view.
  const sync = () => {
    const el = track.current; if (!el) return;
    const middle = el.scrollLeft + el.clientWidth / 2;
    const nearest = cards().reduce((best, card, i, all) => Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) < Math.abs(all[best].offsetLeft + all[best].offsetWidth / 2 - middle) ? i : best, 0);
    setActive(nearest);
  };
  const go = (i: number, focus = false) => {
    const el = track.current, card = cards()[i]; if (!el || !card) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
    setActive(i);
    if (focus) card.focus({ preventScroll: true });
  };
  useEffect(() => { if (!drawn) return; const t = setTimeout(() => setDrawn(undefined), 1600); return () => clearTimeout(t); }, [drawn]);
  const draw = () => {
    if (events.length < 2) return;
    const i = (active + 1 + Math.floor(Math.random() * (events.length - 1))) % events.length;
    setDrawn(events[i].id); go(i);
  };
  const keys = (e: KeyboardEvent) => {
    const i = cards().indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? events.length - 1 : -1;
    if (next < 0 || next >= events.length) return;
    e.preventDefault(); go(next, true);
  };
  return <div className="event-deck">
    <div className="deck-track" ref={track} onScroll={sync} onKeyDown={keys} aria-label="Events" role="group">
      {events.map((event, i) => {
        const Icon = iconFor(event);
        return <button key={event.id} type="button" data-event-id={event.id} className={`deck-card ${event.tone}${i === active ? ' active' : ''}${drawn === event.id ? ' drawn' : ''}`} disabled={disabled} onClick={() => onPick(event.id)}>
          <span className="deck-card-top"><span className="deck-icon"><Icon size={24} strokeWidth={1.5}/></span><span className="deck-tone" aria-hidden>{TONE_LABELS[event.tone]}</span></span>
          <b>{event.name}</b>
          <small>{event.description}</small>
          <span className="deck-effects">{eventEffects(event).map(effect => <span key={effect.key} className={`deck-effect ${effect.good ? 'good' : 'bad'}`}>{effect.value > 0 ? <ArrowUp size={11} aria-hidden/> : <ArrowDown size={11} aria-hidden/>}{effect.label} {effect.value > 0 ? '+' : '−'}{Math.abs(effect.value)}</span>)}</span>
          <span className="deck-cta">Introduce <ArrowUpRight size={14} aria-hidden/></span>
        </button>;
      })}
    </div>
    <div className="deck-controls">
      <button type="button" className="deck-step" aria-label="Previous event" disabled={active === 0} onClick={() => go(active - 1)}><ArrowLeft size={15}/></button>
      <span className="deck-position"><span className="deck-progress" aria-hidden><i style={{ width: `${events.length ? (active + 1) / events.length * 100 : 0}%` }}/></span><span>{events.length ? active + 1 : 0} of {events.length}</span></span>
      <button type="button" className="deck-step" aria-label="Next event" disabled={active >= events.length - 1} onClick={() => go(active + 1)}><ArrowRight size={15}/></button>
      <button type="button" className="deck-draw" disabled={events.length < 2} onClick={draw}><Shuffle size={14}/> Draw a card</button>
    </div>
  </div>;
}
