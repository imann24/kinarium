import { useMemo, type CSSProperties } from 'react';
import { BookOpen, Check, Handshake, Heart, HeartCrack, MessageCircle, Moon, Plus, Sparkles, Zap, type LucideIcon } from 'lucide-react';
import { gameTime } from '../simulation/engine';
import { goodwill, GOODWILL_MAX } from '../simulation/goodwill';
import type { Character, LogEntry, LogKind, Relationship } from '../simulation/types';
import { Person } from './Building';
import { bondKind, bondLabels, type BondKind } from './relationship-label';
import { relationshipNarrative, type StoryPoint } from './relationship-narrative';
import './relationship-story.css';

const bondIcons: Record<BondKind, LucideIcon> = {
  close: Heart, warm: Heart, trusted: Handshake, familiar: MessageCircle, forming: Sparkles,
  repairing: Handshake, easing: Handshake, strained: HeartCrack, unmet: Plus,
};
const sourceIcons: Record<StoryPoint['source'], LucideIcon> = { conversation: MessageCircle, event: Sparkles, repair: Handshake };
const momentIcons: Partial<Record<LogKind, LucideIcon>> = { event: Sparkles, friendship: Heart, conflict: Zap, ritual: Moon, conversation: MessageCircle };

function Portrait({ character, onSelect, mirrored = false }: { character: Character; onSelect: () => void; mirrored?: boolean }) {
  return <button type="button" className="bond-portrait" onClick={onSelect} aria-label={`View ${character.name}`}>
    <span className="bond-portrait-figure" style={{ background: `${character.color}26` }}>
      <svg viewBox="-26 -62 52 67" aria-hidden="true"><g transform={mirrored ? 'scale(-1 1)' : undefined}><Person character={character}/></g></svg>
    </span>
    <b>{character.name}</b><small>{character.trait}</small>
  </button>;
}

function Meter({ label, value, display, diverging = false }: { label: string; value: number; display: string; diverging?: boolean }) {
  const fill: CSSProperties = diverging
    ? { left: value >= 0 ? '50%' : `${50 + value / 2}%`, width: `${Math.abs(value) / 2}%` }
    : { left: 0, width: `${value}%` };
  return <div className={`bond-meter-row${diverging ? ' diverging' : ''}${diverging && value < 0 ? ' negative' : ''}`}>
    <span>{label}</span><b>{display}</b>
    <div className="bond-gauge" role="img" aria-label={`${label} ${display}${diverging ? ' on a scale from −100 to 100' : ' out of 100'}`}><i style={fill}/></div>
  </div>;
}

function Threads({ title, points, tone, scale }: { title: string; points: StoryPoint[]; tone: 'closer' | 'apart'; scale: number }) {
  if (!points.length) return null;
  return <section className={`relationship-points ${tone}`}><h5>{title}</h5>
    <ul>{points.map(p => {
      const Icon = sourceIcons[p.source];
      return <li key={p.key} title={p.detail}>
        <span className="thread-label"><Icon size={13} aria-hidden="true"/><span>{p.title}</span>{p.mended && <Check size={13} className="relationship-mended" aria-label={p.mended}/>}</span>
        <span className="thread-bar"><i style={{ width: `${Math.max(8, p.impact / scale * 100)}%` }}/></span>
        <small aria-hidden="true">×{p.count}</small>
        <span className="sr-only">{p.detail}{p.mended ? `. ${p.mended}` : ''}</span>
      </li>;
    })}</ul>
  </section>;
}

export default function RelationshipStory({ relationship: r, a, b, records, onSelectResident }: { relationship: Relationship; a: Character; b: Character; records: LogEntry[]; onSelectResident: (id: string) => void }) {
  const narrative = useMemo(() => relationshipNarrative(r, a, b), [r, a, b]);
  const names = (id: string) => id === a.id ? a.name : id === b.id ? b.name : 'Someone';
  const kind = bondKind(r);
  const BondIcon = bondIcons[kind];
  const scale = Math.max(1, ...[...narrative.connections, ...narrative.disagreements].map(p => p.impact));
  const strength = Math.min(1, Math.abs(r.affinity) / 100);
  const promiser = r.repairCommitment && [a, b].find(c => c.id === r.repairCommitment!.initiatorId);
  const showGoodwill = !!r.unresolvedConflict || goodwill(r) > 0;
  return <div className="insights-pair relationship-story" aria-live="polite">
    <h4 className="sr-only">{a.name} & {b.name}</h4>
    <div className={`bond-hero bond-${kind}`} style={{ '--bond-strength': strength } as CSSProperties}>
      <Portrait character={a} onSelect={() => onSelectResident(a.id)}/>
      <div className="bond-link">
        <span className="bond-line" aria-hidden="true"/>
        <span className="bond-badge"><BondIcon size={16} aria-hidden="true"/>{bondLabels[kind]}</span>
        <small>{r.encounters} {r.encounters === 1 ? 'encounter' : 'encounters'}{r.encounters ? ` · last ${gameTime(r.lastMinute)}` : ''}</small>
      </div>
      <Portrait character={b} onSelect={() => onSelectResident(b.id)} mirrored/>
    </div>

    <div className="bond-meters">
      <Meter label="Affinity" value={r.affinity} display={`${r.affinity > 0 ? '+' : ''}${Math.round(r.affinity)}`} diverging/>
      <Meter label="Trust" value={r.trust} display={`${Math.round(r.trust)}`}/>
      {showGoodwill && <div className="bond-meter-row">
        <span>Goodwill</span><b>{Math.round(goodwill(r))}/{GOODWILL_MAX}</b>
        <div className="goodwill-pips" role="img" aria-label={`Goodwill ${Math.round(goodwill(r))} of ${GOODWILL_MAX}`}>{Array.from({ length: GOODWILL_MAX }, (_, i) => <i key={i} className={i < Math.round(goodwill(r)) ? 'on' : ''}/>)}</div>
      </div>}
    </div>

    {(r.unresolvedConflict || promiser) && <div className="bond-flags">
      {r.unresolvedConflict && <span className="bond-flag tense"><Zap size={13} aria-hidden="true"/>Unresolved: {r.unresolvedConflict.topic}</span>}
      {promiser && <span className="bond-flag"><Handshake size={13} aria-hidden="true"/>{promiser.name} promised to ask first</span>}
    </div>}

    {(narrative.connections.length || narrative.disagreements.length) ? <div className="relationship-columns">
      <Threads tone="closer" title="What has brought them closer" points={narrative.connections} scale={scale}/>
      <Threads tone="apart" title="What has pulled them apart" points={narrative.disagreements} scale={scale}/>
    </div> : null}

    {kind !== 'unmet' && <>
      <h5>How they see each other</h5>
      <div className="relationship-views">{narrative.views.map(v => <article key={v.from.id} className={v.tone} title={[v.feeling, ...v.details].join(' ')}>
        <span className="view-avatar" style={{ background: `${v.from.color}26` }} aria-hidden="true"><svg viewBox="-26 -62 52 67"><Person character={v.from}/></svg></span>
        <div>
          <small>{v.from.name}, on {v.to.name}</small>
          {v.impression && <p className="view-impression">{v.impression.charAt(0).toUpperCase() + v.impression.slice(1)}</p>}
          {v.words && <blockquote className={v.words.tone}><p>“{v.words.text}”</p><small>{v.from.name} remembers {names(v.words.speakerId)} saying this · {gameTime(v.words.minute)}</small></blockquote>}
        </div>
      </article>)}</div>
    </>}

    {records.length > 0 && <>
      <h5>Recent moments</h5>
      <ol className="bond-moments">{records.slice(0, 5).map(e => {
        const Icon = momentIcons[e.kind] ?? MessageCircle;
        return <li key={e.id} className={`kind-${e.kind}`}><span className="moment-icon"><Icon size={12} aria-hidden="true"/></span><div><small>{gameTime(e.minute)}</small><p>{e.text}</p></div></li>;
      })}</ol>
      {records.length > 5 && <p className="insights-note">Latest 5 of {records.length} retained moments.</p>}
    </>}

    <details className="bond-full-story">
      <summary><BookOpen size={14} aria-hidden="true"/>Read their story</summary>
      <div className="relationship-prose">{narrative.story.map((text, i) => <p key={i}>{text}</p>)}</div>
      {!narrative.recorded && r.encounters > 0 && <p className="insights-note">This connection began before richer relationship records were kept; its story fills in from the next shared moment.</p>}
      {kind !== 'unmet' && narrative.views.map(v => <p key={v.from.id} className="view-feeling">{v.feeling} {v.details.join(' ')}</p>)}
      <p className="insights-note">Affinity runs from −100 to 100 and trust from 0 to 100. Read from recorded moments, not motives; shared events and time also change scores.</p>
    </details>
  </div>;
}
