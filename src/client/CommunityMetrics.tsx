import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Heart, Sprout, X, Zap } from 'lucide-react';
import type { CommunityMetric } from '../simulation/community-state';
import { gameTime } from '../simulation/engine';
import type { WorldState } from '../simulation/types';
import { communityMetricDetails, signedMetric } from './community-metric-details';
import './community-metrics.css';

const metrics = [
  { key: 'cohesion', label: 'Togetherness', Icon: Heart, color: '#7d926e', description: (n: number) => n > 65 ? 'Roots are taking hold' : n > 40 ? 'Finding common ground' : 'Drifting apart' },
  { key: 'tension', label: 'Tension', Icon: Zap, color: '#c79b6c', description: (n: number) => n > 60 ? 'Something needs to give' : n > 30 ? 'A few frayed edges' : 'Room to breathe' },
  { key: 'resources', label: 'Shared resources', Icon: Sprout, color: '#8ca8a3', description: (n: number) => n > 60 ? 'Enough to share' : n > 25 ? 'Making things stretch' : 'The cupboards feel bare' },
] as const;

// Tension is the only stat where a rise is bad.
const changeTone = (metric: CommunityMetric, delta: number) => delta === 0 ? '' : (delta > 0) === (metric !== 'tension') ? 'good' : 'bad';

export default function CommunityMetrics({ world }: { world: WorldState }) {
  const id = useId(), root = useRef<HTMLElement>(null), panel = useRef<HTMLDivElement>(null);
  const buttons = useRef<Partial<Record<CommunityMetric, HTMLButtonElement | null>>>({});
  const pointerToggle = useRef(false);
  const dismissed = useRef<CommunityMetric | undefined>(undefined);
  const suppressFocus = useRef(false), focusPanel = useRef(false);
  const [active, setActive] = useState<CommunityMetric>();
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 12 });
  const [layout, setLayout] = useState(0), relayout = () => setLayout(n => n + 1);
  const close = (restore = false) => {
    dismissed.current = active;
    if (restore && active) {
      suppressFocus.current = true; buttons.current[active]?.focus(); suppressFocus.current = false;
    }
    setActive(undefined); setPinned(false);
  };
  useEffect(() => {
    if (!active) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [active]);
  useLayoutEffect(() => {
    if (active && focusPanel.current) { focusPanel.current = false; panel.current?.focus(); }
  }, [active, pinned]);
  useLayoutEffect(() => {
    if (!active) return;
    const place = () => {
      const trigger = buttons.current[active]?.getBoundingClientRect(), box = panel.current?.getBoundingClientRect();
      if (!trigger || !box) return;
      const below = trigger.bottom + 8;
      setPosition({ left: Math.max(12, Math.min(innerWidth - box.width - 12, trigger.left)),
        top: Math.max(12, Math.min(innerHeight - box.height - 12, below + box.height <= innerHeight - 12 ? below : trigger.top - box.height - 8)) });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [active, world, layout]);
  const detail = active ? communityMetricDetails(world, active) : undefined;
  const label = metrics.find(m => m.key === active)?.label;
  return <section ref={root} className="community-stats world-summary metric-summary" aria-label="Community summary"
    onPointerLeave={() => { dismissed.current = undefined; if (!pinned && !root.current?.contains(document.activeElement)) close(); }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}>
    {metrics.map(({ key, label, Icon, color, description }) => <button type="button" className="stat metric-trigger" key={key}
      ref={node => { buttons.current[key] = node; }} aria-label={`${label}: ${Math.round(world[key])} of 100. Show what affects this score`}
      aria-expanded={active === key} aria-controls={`${id}-details`} aria-haspopup="dialog"
      onPointerEnter={event => { if (event.pointerType !== 'touch' && !pinned && dismissed.current !== key) setActive(key); }}
      onFocus={() => { if (!suppressFocus.current && !(pinned && active === key)) { setActive(key); setPinned(false); } }}
      onPointerDown={event => { pointerToggle.current = active === key && (pinned || event.pointerType === 'touch'); }}
      onClick={() => {
        if (pointerToggle.current || (pinned && active === key)) close();
        else { dismissed.current = undefined; focusPanel.current = true; setActive(key); setPinned(true); }
        pointerToggle.current = false;
      }}>
      <div><Icon size={17} aria-hidden="true"/><span>{label}</span><b>{Math.round(world[key])}<small>/100</small></b></div>
      <div className="stat-track" aria-hidden="true"><span style={{ width: `${world[key]}%`, background: color }}/></div>
      <p>{description(world[key])}</p>
    </button>)}
    {detail && active && <div ref={panel} key={active} id={`${id}-details`} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1}
      className="metric-details" style={position}>
      <div className="metric-details-heading"><h3 id={`${id}-title`}>{label} · {signedMetric(world[active]).replace(/^\+/, '')}/100</h3>
        <button type="button" className="icon-button" aria-label="Close score details" onClick={() => close(true)}><X size={16}/></button></div>
      <p>{detail.summary}</p>
      <p className="metric-headline"><b>Right now:</b> {detail.headline}</p>
      <h4>Recent changes</h4>
      {detail.recent.length ? <ul className="metric-changes">{detail.recent.map(change => <li key={`${change.eventId}:${change.minute}`}><span>{change.cause}</span><b className={changeTone(active, change[active])}>{signedMetric(change[active])}{changeTone(active, change[active]) && <span className="sr-only"> ({changeTone(active, change[active]) === 'good' ? 'moves the community in a good direction' : 'moves the community in a worse direction'})</span>}</b><small>{gameTime(change.minute)}</small></li>)}</ul> : <p className="metric-note">None recorded in the last six simulation hours.</p>}
      <details className="metric-more" onToggle={relayout}><summary>Read more about current pressures</summary>
        <p className="metric-note">Per simulation step (2 minutes), using current positions. Movement and new encounters can change these.</p>
        <ul>{detail.current.map(text => <li key={text}>{text}</li>)}</ul></details>
      <details className="metric-more" onToggle={relayout}><summary>Read more about how this score works</summary>
        <p>{detail.meaning}</p><p className="metric-note">Scores accumulate from the house’s starting state and stay between 0 and 100. They are not a sum of the factors shown here.</p>
        <p className="metric-note">Recent changes lists up to five recorded changes in the last six simulation hours. Ongoing pressures are separate; older saves have no backfilled causes.</p></details>
    </div>}
  </section>;
}
