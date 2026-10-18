import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Armchair, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BedDouble, CalendarX, Cake, ChevronLeft, ChevronRight, Clock3, Droplets, GalleryHorizontalEnd, Gift, Handshake, HeartCrack, LayoutGrid, Megaphone, MessageCircle, Moon, PackageSearch, Receipt, ShoppingBasket, Shuffle, Soup, Sprout, Thermometer, UserMinus, Vote, Wind, Zap } from 'lucide-react';
import type { EventDefinition } from '../simulation/catalog';
import { EVENT_VIEW_KEY, TONE_FILTERS, TONE_LABELS, countdown, eventEffects, filterEvents, initialEventView, waitLeft, type EventView, type EventWait, type ToneFilter } from './event-effects';
import './event-picker.css';

export const EVENT_ICONS = {
  soup: Soup, gift: Gift, moon: Moon, sprout: Sprout, zap: Zap, message: MessageCircle, armchair: Armchair, handshake: Handshake, wind: Wind,
  droplets: Droplets, 'package-search': PackageSearch, megaphone: Megaphone, basket: ShoppingBasket, bed: BedDouble, 'heart-crack': HeartCrack,
  'user-minus': UserMinus, 'calendar-x': CalendarX, vote: Vote, receipt: Receipt, thermometer: Thermometer, cake: Cake,
};
const iconFor = (event: EventDefinition) => EVENT_ICONS[event.icon as keyof typeof EVENT_ICONS] ?? Sprout;

/** What a resting card says instead of inviting a tap. */
function waitLabel(wait: EventWait, now: number) {
  const left = countdown(wait.readyAt - now);
  return wait.reason === 'world' ? `Settling · ready in ${left}` : `Allowance spent · back in ${left}`;
}

function savedView() {
  try { return localStorage.getItem(EVENT_VIEW_KEY); } catch { return null; /* Storage may be unavailable, or this is a server render. */ }
}

/**
 * The player-triggered events, as a swipeable card deck (the default on phones) or the original
 * grid. Either way one tap introduces an event; the deck also shows what each one moves. While
 * the world settles or the allowance is spent, every card shows the wait and how long is left.
 */
export default function EventPicker({ events, disabled, phone, wait, now = 0, onPick }: { events: EventDefinition[]; disabled: boolean; phone: boolean; wait?: EventWait; now?: number; onPick: (id: string) => void }) {
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
      ? <EventDeck key={tone} events={shown} disabled={disabled || !!wait} wait={wait} now={now} onPick={onPick}/>
      : <div className="event-grid">{shown.map(event => { const Icon = iconFor(event); return <button key={event.id} data-event-id={event.id} className={`event-card ${event.tone}${wait ? ' waiting' : ''}`} title={wait ? waitLabel(wait, now) : event.description} disabled={disabled || !!wait} onClick={() => onPick(event.id)}><span className="event-icon"><Icon size={20} strokeWidth={1.5}/></span><b>{event.name}</b><small>{event.description}</small>{wait
        ? <span className={`event-wait ${wait.reason}`}><Clock3 size={11} aria-hidden/><span className="sr-only">{waitLabel(wait, now)}</span><span aria-hidden>{countdown(wait.readyAt - now)}</span></span>
        : <ArrowUpRight size={14} className="event-arrow"/>}</button>; })}</div>}
  </div>;
}

function EventDeck({ events, disabled, wait, now, onPick }: { events: EventDefinition[]; disabled: boolean; wait?: EventWait; now: number; onPick: (id: string) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ active: 0, first: 0, last: 0, atStart: true, atEnd: events.length < 2 });
  const [drawn, setDrawn] = useState<string>();
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number }>(undefined);
  const dragged = useRef(false);
  const cards = () => [...(track.current?.querySelectorAll<HTMLElement>('.deck-card') ?? [])];
  const smooth = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  // Which cards are in view: the one nearest the middle is active, and wide screens show a range.
  const sync = () => {
    const el = track.current; if (!el) return;
    const all = cards(); if (!all.length) return;
    const centre = (card: HTMLElement) => card.offsetLeft + card.offsetWidth / 2;
    const middle = el.scrollLeft + el.clientWidth / 2;
    const active = all.reduce((best, card, i) => Math.abs(centre(card) - middle) < Math.abs(centre(all[best]) - middle) ? i : best, 0);
    const shown = all.map((card, i) => [i, centre(card)] as const).filter(([, c]) => c >= el.scrollLeft && c <= el.scrollLeft + el.clientWidth).map(([i]) => i);
    setView({ active, first: shown[0] ?? active, last: shown.at(-1) ?? active, atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(sync, [events]);
  const go = (i: number, focus = false) => {
    const el = track.current, card = cards()[i]; if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: smooth() });
    if (focus) card.focus({ preventScroll: true });
  };
  // One card at a time on a phone; on a wide screen, a whole page of cards, keeping one in view for context.
  const page = (direction: 1 | -1) => {
    const el = track.current, [a, b] = cards(); if (!el || !a) return;
    const step = b ? b.offsetLeft - a.offsetLeft : a.offsetWidth;
    el.scrollBy({ left: direction * Math.max(step, el.clientWidth - step), behavior: smooth() });
  };
  useEffect(() => { if (!drawn) return; const t = setTimeout(() => setDrawn(undefined), 1600); return () => clearTimeout(t); }, [drawn]);
  const draw = () => {
    if (events.length < 2) return;
    const i = (view.active + 1 + Math.floor(Math.random() * (events.length - 1))) % events.length;
    setDrawn(events[i].id); go(i);
  };
  const keys = (e: KeyboardEvent) => {
    const direction = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const i = cards().indexOf(document.activeElement as HTMLElement);
    // With the deck itself focused, arrows page through it; with a card focused, they move to its neighbour.
    if (i < 0) {
      if (document.activeElement !== track.current) return;
      if (direction) { e.preventDefault(); page(direction); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); go(e.key === 'Home' ? 0 : events.length - 1); }
      return;
    }
    const next = direction ? i + direction : e.key === 'Home' ? 0 : e.key === 'End' ? events.length - 1 : -1;
    if (next < 0 || next >= events.length) return;
    e.preventDefault(); go(next, true);
  };
  // A mouse can drag the deck sideways like a finger; touch and trackpads scroll it natively.
  const pointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false, id: e.pointerId };
  };
  const pointerMove = (e: PointerEvent) => {
    const d = drag.current, el = track.current; if (!d || !el || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 6) return;
    if (!d.moved) { d.moved = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); }
    el.scrollLeft = d.left - dx;
  };
  const pointerUp = (e: PointerEvent) => {
    const d = drag.current, el = track.current; drag.current = undefined;
    if (!d?.moved || !el) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    el.classList.remove('dragging');
    // A drag is not a choice: swallow the click that ends it, then settle on the nearest card.
    dragged.current = true; setTimeout(() => { dragged.current = false; }, 0);
    sync(); const all = cards(), middle = el.scrollLeft + el.clientWidth / 2;
    const nearest = all.reduce((best, card, i) => Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle) < Math.abs(all[best].offsetLeft + all[best].offsetWidth / 2 - middle) ? i : best, 0);
    go(nearest);
  };
  const { active, first, last, atStart, atEnd } = view;
  return <div className="event-deck">
    <div className="deck-viewport">
      <div className="deck-track" ref={track} tabIndex={0} onScroll={sync} onKeyDown={keys} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
        onClickCapture={e => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); } }} aria-label="Events" role="group">
        {events.map((event, i) => {
          const Icon = iconFor(event);
          return <button key={event.id} type="button" data-event-id={event.id} className={`deck-card ${event.tone}${i === active ? ' active' : ''}${drawn === event.id ? ' drawn' : ''}${wait ? ' waiting' : ''}`} disabled={disabled} onClick={() => onPick(event.id)}>
            <span className="deck-card-top"><span className="deck-icon"><Icon size={24} strokeWidth={1.5}/></span><span className="deck-tone" aria-hidden>{TONE_LABELS[event.tone]}</span>{wait && <span className="deck-wait-bar" aria-hidden><i style={{ width: `${waitLeft(wait, now) * 100}%` }}/></span>}</span>
            <b>{event.name}</b>
            <small>{event.description}</small>
            <span className="deck-effects">{eventEffects(event).map(effect => <span key={effect.key} className={`deck-effect ${effect.good ? 'good' : 'bad'}`}>{effect.value > 0 ? <ArrowUp size={11} aria-hidden/> : <ArrowDown size={11} aria-hidden/>}{effect.label} {effect.value > 0 ? '+' : '−'}{Math.abs(effect.value)}</span>)}</span>
            {wait
              ? <span className={`deck-cta deck-wait ${wait.reason}`}><Clock3 size={13} aria-hidden/>{waitLabel(wait, now)}</span>
              : <span className="deck-cta">Introduce <ArrowUpRight size={14} aria-hidden/></span>}
          </button>;
        })}
      </div>
      <button type="button" className="deck-side previous" aria-label="Previous events" tabIndex={-1} disabled={atStart} onClick={() => page(-1)}><ChevronLeft size={22}/></button>
      <button type="button" className="deck-side next" aria-label="Next events" tabIndex={-1} disabled={atEnd} onClick={() => page(1)}><ChevronRight size={22}/></button>
    </div>
    <div className="deck-controls">
      <button type="button" className="deck-step" aria-label="Previous event" disabled={atStart} onClick={() => page(-1)}><ArrowLeft size={15}/></button>
      <span className="deck-position"><span className="deck-progress" aria-hidden><i style={{ marginLeft: `${events.length ? first / events.length * 100 : 0}%`, width: `${events.length ? (last - first + 1) / events.length * 100 : 0}%` }}/></span><span>{!events.length ? '0 of 0' : first === last ? `${first + 1} of ${events.length}` : `${first + 1}–${last + 1} of ${events.length}`}</span></span>
      <button type="button" className="deck-step" aria-label="Next event" disabled={atEnd} onClick={() => page(1)}><ArrowRight size={15}/></button>
      <button type="button" className="deck-draw" disabled={events.length < 2} onClick={draw}><Shuffle size={14}/> Draw a card</button>
    </div>
  </div>;
}
