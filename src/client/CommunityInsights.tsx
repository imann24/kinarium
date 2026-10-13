import { useMemo, useState } from 'react';
import { gameTime } from '../simulation/engine';
import type { WorldState } from '../simulation/types';
import { communityInsights, pairRecords, recentActivity, type BondKind, type InsightScope } from './community-insights';
import './community-insights.css';

const labels: Record<BondKind, string> = { close: 'Growing close', strained: 'Strained', forming: 'Getting acquainted', unmet: 'Yet to meet' };
const score = (value: number | null) => value === null ? '—' : `${Math.round(value)}/100`;

export default function CommunityInsights({ world, onSelectResident }: { world: WorldState; onSelectResident: (id: string) => void }) {
  const [scope, setScope] = useState<InsightScope>('home');
  const [filter, setFilter] = useState<'all' | BondKind>('all');
  const [selected, setSelected] = useState<string>();
  const data = useMemo(() => communityInsights(world, scope), [world, scope]);
  const activity = useMemo(() => recentActivity(world), [world]);
  const bonds = data.bonds.filter(b => filter === 'all' || b.kind === filter)
    .sort((a, b) => b.relationship.encounters - a.relationship.encounters || a.a.name.localeCompare(b.a.name));
  const chosen = data.bonds.find(b => `${b.a.id}:${b.b.id}` === selected);
  const records = chosen ? pairRecords(activity.entries, chosen.a.id, chosen.b.id) : [];
  return <section className="community-insights" aria-labelledby="insights-title">
    <div className="insights-heading"><div><p className="eyebrow">NOTICING LIFE TOGETHER</p><h2 id="insights-title">Community insights</h2><p>Current feelings, familiar faces, and the moments on record.</p></div>
      <label className="insights-scope">Current statistics for<select value={scope} onChange={e => { setScope(e.target.value as InsightScope); setSelected(undefined); }}><option value="home">Residents at home</option><option value="all">Everyone, including away</option></select></label></div>
    <p className="insights-note">{data.residents.length} residents in this view · {world.characters.filter(c => c.away).length} away in the world. Scores describe the simulation now; they are not goals.</p>
    <div className="insights-summary">
      <div><span>Average mood</span><strong>{score(data.mood)}</strong><small>{data.residents.length ? 'Equal weight per resident' : 'No residents in this view'}</small></div>
      <div><span>Average belonging</span><strong>{score(data.belonging)}</strong><small>{data.residents.length ? 'Equal weight per resident' : 'No residents in this view'}</small></div>
      <div><span>Pairs who have met</span><strong>{data.met.length} <small>/ {data.possiblePairs}</small></strong><small>{data.possiblePairs ? `${data.notMet} pairs have no encounters yet` : 'Needs at least two residents'}</small></div>
      <div><span>Average trust · met pairs</span><strong>{score(data.trust)}</strong><small>{data.met.length ? `${data.encounters} encounters across these pairs, all time` : 'No recorded encounters yet'}</small></div>
    </div>
    <div className="insights-columns">
      <section className="insights-panel"><h3>Between neighbors</h3><p className="insights-note">{data.close} growing close · {data.forming} getting acquainted · {data.strained} strained</p>
        <label className="insights-filter">Explore connections<select value={filter} onChange={e => { setFilter(e.target.value as typeof filter); setSelected(undefined); }}><option value="all">All connections</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <p className="insights-note">Sorted by encounters. Growing close: affinity above 35; strained: below −20. Pairs without encounters stay “yet to meet,” even if shared events changed their scores.</p>
        <div className="insights-bond-list" aria-label="Connections">{bonds.map(({ a, b, relationship: r, kind }) => <button key={`${a.id}:${b.id}`} className="insights-bond" aria-pressed={selected === `${a.id}:${b.id}`} onClick={() => setSelected(`${a.id}:${b.id}`)}><span><b>{a.name}{a.away ? ' (away)' : ''} & {b.name}{b.away ? ' (away)' : ''}</b><small>{labels[kind]} · {r.encounters} encounters</small></span><span>Affinity {Math.round(r.affinity)}<small>Trust {score(r.trust)}</small></span></button>)}{!bonds.length && <p className="insights-empty">{data.possiblePairs === 0 ? 'Connections need at least two residents in this view.' : 'No connections in this group yet.'}</p>}</div>
        {chosen ? <div className="insights-pair" aria-live="polite"><h4>{chosen.a.name} & {chosen.b.name}</h4><p className="insights-note">Affinity {Math.round(chosen.relationship.affinity)} (−100 to 100) · Trust {score(chosen.relationship.trust)}.<br/>{chosen.relationship.encounters ? `Last encounter: ${gameTime(chosen.relationship.lastMinute)}.` : 'No encounters recorded yet.'} Scores can also change through shared events and time.</p><div className="insights-profile-links">{[chosen.a, chosen.b].map(c => <button key={c.id} className="outline" onClick={() => onSelectResident(c.id)}>View {c.name}</button>)}</div><h4>Recent recorded moments</h4>{records.slice(0, 5).map(e => <article key={e.id}><small>{gameTime(e.minute)} · {e.kind}</small><p>{e.text}</p></article>)}{!records.length && <p className="insights-empty">No moments for this pair in the retained journal. Older encounters may exist.</p>}{records.length > 5 && <p className="insights-note">Showing the latest 5 of {records.length} retained moments for this pair.</p>}</div> : <p className="insights-note">Choose a connection to see both residents and its recent recorded moments.</p>}
      </section>
      <section className="insights-panel"><h3>A closer look at belonging</h3><p className="insights-note">Lowest current belonging first. Connections count people in this view they have met; these numbers do not explain how someone feels.</p><div className="insights-resident-list">{data.residentDetails.map(({ character: c, met }) => <button className="insights-resident" key={c.id} onClick={() => onSelectResident(c.id)}><span><b>{c.name}{c.away ? ' (away)' : ''}</b><small>{met} of {Math.max(0, data.residents.length - 1)} neighbors met</small></span><span>Belonging {score(c.belonging)}<small>Mood {score(c.mood)}</small></span></button>)}{!data.residents.length && <p className="insights-empty">Nobody is at home. Include away residents to explore their saved relationships and feelings.</p>}</div></section>
    </div>
    <section className="insights-panel insights-activity"><h3>Recent recorded activity</h3><p className="insights-note">Whole world, including residents now away · three two-hour windows in simulation time. Counts come only from the retained journal (up to 80 entries), not the full archive. Missing entries and skipped catch-up time can hide activity; zero means no retained records.</p>
      {activity.entries.length ? <><p className="insights-note">Retained journal: {gameTime(activity.earliest!)} to now ({gameTime(world.minute)}). {activity.truncated ? 'Older entries exist in the Journal.' : 'Includes the start of this world.'}</p><div className="insights-table-wrap"><table><caption>Recorded conversations and conflicts over the last six simulation hours</caption><thead><tr><th scope="col">Simulation window</th><th scope="col">Conversations</th><th scope="col">Conflicts</th></tr></thead><tbody>{activity.buckets.map((bucket, index) => <tr key={index}><th scope="row">{[ '6–4 hours ago', '4–2 hours ago', 'Last 2 hours' ][index]}{bucket.partial && <small>Starts before retained journal</small>}</th><td>{bucket.conversations}</td><td>{bucket.conflicts}</td></tr>)}</tbody></table></div></> : <p className="insights-empty">No journal records are available yet. Recorded activity will appear as the world unfolds.</p>}
      <p className="insights-note">Conversations and conflicts are separate journal categories. Friendship milestones are excluded to avoid counting the same encounter twice. Past mood, belonging, and trust scores are not stored, so score trends are unavailable.</p>
    </section>
  </section>;
}
