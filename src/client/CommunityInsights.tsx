import { useEffect, useMemo, useState } from 'react';
import { gameTime } from '../simulation/engine';
import type { WorldState } from '../simulation/types';
import { communityInsights, pairRecords, recentActivity, type BondKind, type InsightScope } from './community-insights';
import './community-insights.css';
import HouseNarrative from './HouseNarrative';
import RelationshipModal from './RelationshipModal';
import { bondLabels as labels } from './relationship-label';

const kinds = Object.keys(labels) as BondKind[];

export function insightLocation(search: string) {
  const params = new URLSearchParams(search);
  const filter = params.get('connections');
  return { scope: params.get('scope') === 'all' ? 'all' as const : 'home' as const,
    filter: kinds.includes(filter as BondKind) ? filter as BondKind : 'all' as const,
    selected: params.get('pair') || undefined };
}

function Meter({ value, affinity = false }: { value: number | null; affinity?: boolean }) {
  return <span className={`insight-meter ${affinity ? 'affinity-meter' : ''}`} aria-hidden="true"><i style={{ width: `${value === null ? 0 : affinity ? Math.abs(value) / 2 : value}%`, left: affinity ? `${value !== null && value < 0 ? 50 + value / 2 : 50}%` : undefined }}/></span>;
}

const score = (value: number | null) => value === null ? '—' : `${Math.round(value)}/100`;

export default function CommunityInsights({ world, onSelectResident }: { world: WorldState; onSelectResident: (id: string) => void }) {
  const [initial] = useState(() => insightLocation(typeof window === 'undefined' ? '' : window.location.search));
  const [scope, setScope] = useState<InsightScope>(initial.scope);
  const [filter, setFilter] = useState<'all' | BondKind>(initial.filter);
  const [selected, setSelected] = useState<string | undefined>(initial.selected);
  useEffect(() => {
    if (!window.location.pathname.match(/\/insights\/?$/)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('scope', scope);
    url.searchParams.set('connections', filter);
    if (selected) url.searchParams.set('pair', selected); else url.searchParams.delete('pair');
    window.history.replaceState(window.history.state, '', url);
  }, [scope, filter, selected]);
  const data = useMemo(() => communityInsights(world, scope), [world, scope]);
  const activity = useMemo(() => recentActivity(world), [world]);
  const bonds = data.bonds.filter(b => filter === 'all' || b.kind === filter)
    .sort((a, b) => b.relationship.encounters - a.relationship.encounters || a.a.name.localeCompare(b.a.name));
  const chosen = data.bonds.find(b => `${b.a.id}:${b.b.id}` === selected);
  const distribution = { ...data.distribution, unmet: data.notMet };
  const activityMax = Math.max(1, ...activity.buckets.flatMap(b => [b.conversations, b.conflicts]));
  const records = chosen ? pairRecords(activity.entries, chosen.a.id, chosen.b.id) : [];
  return <section className="community-insights" aria-labelledby="insights-title">
    <div className="insights-heading"><div><h2 id="insights-title">A community, in focus.</h2><p>Current feelings, familiar faces, and the moments on record.</p></div>
      <label className="insights-scope">Current statistics for<select value={scope} onChange={e => { setScope(e.target.value as InsightScope); setSelected(undefined); }}><option value="home">Residents at home</option><option value="all">Everyone, including away</option></select></label></div>
    <p className="insights-note">{data.residents.length} residents in this view · {world.characters.filter(c => c.away).length} away in the world. Scores describe the simulation now; they are not goals.</p>
    <HouseNarrative world={world}/>
    <div className="insights-summary">
      <div><span>Average mood</span><strong>{score(data.mood)}</strong><small>{data.residents.length ? 'Equal weight per resident' : 'No residents in this view'}</small></div>
      <div><span>Average belonging</span><strong>{score(data.belonging)}</strong><small>{data.residents.length ? 'Equal weight per resident' : 'No residents in this view'}</small></div>
      <div><span>Pairs who have met</span><strong>{data.met.length} <small>/ {data.possiblePairs}</small></strong><small>{data.possiblePairs ? `${data.notMet} pairs have no encounters yet` : 'Needs at least two residents'}</small></div>
      <div><span>Average trust · met pairs</span><strong>{score(data.trust)}</strong><small>{data.met.length ? `${data.encounters} encounters across these pairs, all time` : 'No recorded encounters yet'}</small></div>
    </div>
    <section className="insights-panel insights-distribution" aria-labelledby="connections-overview"><div><h3 id="connections-overview">Every connection has a beginning.</h3><p className="insights-note">All {data.possiblePairs} possible pairs in this view. Choose a group to explore its connections below.</p></div>
      <div className="connection-stack" aria-hidden="true">{kinds.map(kind => <span key={kind} className={`bond-tone-${kind}`} style={{ width: `${data.possiblePairs ? distribution[kind] / data.possiblePairs * 100 : 0}%` }}/>)}</div>
      <div className="connection-key">{kinds.filter(kind => distribution[kind] > 0 || filter === kind).map(kind => <button key={kind} aria-pressed={filter === kind} onClick={() => { setFilter(filter === kind ? 'all' : kind); setSelected(undefined); }}><i className={`bond-tone-${kind}`} aria-hidden="true"/><span>{labels[kind]}</span><b>{distribution[kind]}</b></button>)}</div>
      {!data.possiblePairs && <p className="insights-empty">Welcome at least two residents to see the social fabric take shape.</p>}
    </section>
    <div className="insights-columns">
      <section className="insights-panel"><h3>Between neighbors</h3><p className="insights-note">{kinds.filter(kind => kind !== 'unmet' && distribution[kind] > 0).map(kind => `${distribution[kind]} ${labels[kind].toLowerCase()}`).join(' · ')}</p>
        <label className="insights-filter">Explore connections<select value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setSelected(undefined); }}><option value="all">All connections ({data.possiblePairs})</option>{kinds.map(kind => <option key={kind} value={kind} disabled={!distribution[kind] && filter !== kind}>{labels[kind]} ({distribution[kind]})</option>)}</select></label>
        <details className="insights-explainer"><summary>How connection labels work</summary><p className="insights-note">Sorted by encounters. Familiarity starts at 10 encounters or a recorded friendship. Close requires affinity above 35 and trust above 55; either alone means fond but cautious or trusted, not close. Affinity below −20 or an unresolved conflict means strained; a matching repair commitment means repair promised, and goodwill of 3 or more from honored choices means easing. Pairs without encounters stay “yet to meet,” even if shared events changed their scores.</p></details>
        <div className="insights-bond-list" aria-label="Connections">{bonds.map(({ a, b, relationship: r, kind }) => <button key={`${a.id}:${b.id}`} className="insights-bond" aria-haspopup="dialog" onClick={() => setSelected(`${a.id}:${b.id}`)}><span><b>{a.name}{a.away ? ' (away)' : ''} & {b.name}{b.away ? ' (away)' : ''}</b><small>{labels[kind]} · {r.encounters} encounters</small></span><span>Affinity {Math.round(r.affinity)}<Meter value={r.affinity} affinity/><small>Trust {score(r.trust)}</small></span></button>)}{!bonds.length && <p className="insights-empty">{data.possiblePairs === 0 ? 'Connections need at least two residents in this view.' : 'No connections in this group yet.'}</p>}</div>
        <p className="insights-note">Choose a connection to read its story: how it began, what drew them together or apart, and how each sees the other.</p>
      </section>
      <section className="insights-panel"><h3>A closer look at belonging</h3><p className="insights-note">Lowest current belonging first. Connections count people in this view they have met; these numbers do not explain how someone feels.</p><div className="insights-resident-list">{data.residentDetails.map(({ character: c, met }) => <button className="insights-resident" key={c.id} onClick={() => onSelectResident(c.id)}><span><b>{c.name}{c.away ? ' (away)' : ''}</b><small>{met} of {Math.max(0, data.residents.length - 1)} neighbors met</small></span><span>Belonging {score(c.belonging)}<Meter value={c.belonging}/><small>Mood {score(c.mood)}</small></span></button>)}{!data.residents.length && <p className="insights-empty">Nobody is at home. Include away residents to explore their saved relationships and feelings.</p>}</div></section>
    </div>
    {chosen && <RelationshipModal relationship={chosen.relationship} a={chosen.a} b={chosen.b} records={records} onClose={() => setSelected(undefined)} onSelectResident={id => { setSelected(undefined); onSelectResident(id); }}/>}
    <section className="insights-panel insights-activity"><h3>Recent recorded activity</h3><p className="insights-note">Whole world, including residents now away · three two-hour windows in simulation time. Counts come only from the retained journal (up to 80 entries), not the full archive. Missing entries and skipped catch-up time can hide activity; zero means no retained records.</p>
      {activity.entries.length ? <><p className="insights-note">Retained journal: {gameTime(activity.earliest!)} to now ({gameTime(world.minute)}). {activity.truncated ? 'Older entries exist in the Journal.' : 'Includes the start of this world.'}</p><div className="activity-chart" role="img" aria-label={`Retained journal activity. ${activity.buckets.map((b, i) => `${['6–4 hours ago', '4–2 hours ago', 'Last 2 hours'][i]}: ${b.conversations} conversations, ${b.conflicts} conflicts${b.partial ? ', partial history' : ''}`).join('. ')}. Counts, not rates.`}>
        {activity.buckets.map((bucket, index) => <div className="activity-window" key={index} aria-hidden="true"><b>{['6–4 hours ago', '4–2 hours ago', 'Last 2 hours'][index]}</b>{bucket.partial && <small>Partial history</small>}{(['conversations', 'conflicts'] as const).map(kind => <div className={`activity-series ${kind}`} key={kind}><span>{kind}</span><div><i style={{ width: `${bucket[kind] / activityMax * 100}%` }}/></div><b>{bucket[kind]}</b></div>)}</div>)}
      </div></> : <p className="insights-empty">No journal records are available yet. Recorded activity will appear as the world unfolds.</p>}
      <p className="insights-note">Conversations and conflicts are separate journal categories. Friendship milestones are excluded to avoid counting the same encounter twice. Past mood, belonging, and trust scores are not stored, so score trends are unavailable.</p>
    </section>
  </section>;
}
