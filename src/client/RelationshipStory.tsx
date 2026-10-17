import { useMemo } from 'react';
import { gameTime } from '../simulation/engine';
import type { Character, LogEntry, Relationship } from '../simulation/types';
import { relationshipNarrative, type StoryPoint } from './relationship-narrative';

function Points({ title, points, empty, tone }: { title: string; points: StoryPoint[]; empty: string; tone: 'closer' | 'apart' }) {
  return <section className={`relationship-points ${tone}`}><h5>{title}</h5>
    {points.length ? <ul>{points.map(p => <li key={p.key}><b>{p.title}</b><small>{p.detail}</small>{p.mended && <small className="relationship-mended">{p.mended}</small>}</li>)}</ul> : <p className="insights-empty">{empty}</p>}
  </section>;
}

export default function RelationshipStory({ relationship: r, a, b, records, onSelectResident }: { relationship: Relationship; a: Character; b: Character; records: LogEntry[]; onSelectResident: (id: string) => void }) {
  const narrative = useMemo(() => relationshipNarrative(r, a, b), [r, a, b]);
  const names = (id: string) => id === a.id ? a.name : id === b.id ? b.name : 'Someone';
  return <div className="insights-pair relationship-story" aria-live="polite">
    <p className="eyebrow">THEIR STORY SO FAR</p>
    <h4>{a.name} & {b.name}</h4>
    <div className="relationship-prose">{narrative.story.map((text, i) => <p key={i}>{text}</p>)}</div>
    {!narrative.recorded && r.encounters > 0 && <p className="insights-note">This connection began before richer relationship records were kept; its story fills in from the next shared moment.</p>}
    <div className="relationship-columns">
      <Points tone="closer" title="What has brought them closer" points={narrative.connections} empty="No defining moments of connection recorded yet."/>
      <Points tone="apart" title="What has pulled them apart" points={narrative.disagreements} empty="No disagreements recorded between them."/>
    </div>
    <h5>How they see each other</h5>
    <div className="relationship-views">{narrative.views.map(v => <article key={v.from.id}>
      <b>{v.from.name}, on {v.to.name}</b>
      <p>{v.feeling} {v.details.join(' ')}</p>
      {v.words && <blockquote className={v.words.tone}><p>“{v.words.text}”</p><small>{v.from.name} remembers {names(v.words.speakerId)} saying this · {gameTime(v.words.minute)}</small></blockquote>}
    </article>)}</div>
    <p className="insights-note">Affinity {Math.round(r.affinity)} (−100 to 100) · Trust {Math.round(r.trust)}/100 · {r.encounters} encounters{r.encounters ? `, last on ${gameTime(r.lastMinute)}` : ''}. Read from recorded moments, not motives; shared events and time also change scores.</p>
    <div className="insights-profile-links">{[a, b].map(c => <button key={c.id} className="outline" onClick={() => onSelectResident(c.id)}>View {c.name}</button>)}</div>
    <h5>Recent recorded moments</h5>
    {records.slice(0, 5).map(e => <article key={e.id}><small>{gameTime(e.minute)} · {e.kind}</small><p>{e.text}</p></article>)}
    {!records.length && <p className="insights-empty">No moments for this pair in the retained journal. Older encounters may exist.</p>}
    {records.length > 5 && <p className="insights-note">Showing the latest 5 of {records.length} retained moments for this pair.</p>}
  </div>;
}
