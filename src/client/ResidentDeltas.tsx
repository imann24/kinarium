import type { CSSProperties } from 'react';

/** Rounded for scanning; the exact value stays in the title and screen-reader text. */
export function shortSigned(value: number) {
  if (Math.abs(value) < 0.0005) return '0';
  const digits = Math.abs(value) < 0.1 ? 3 : 2;
  return `${value > 0 ? '+' : '−'}${Number(Math.abs(value).toFixed(digits))}`;
}
const exact = (value: number) => value === 0 ? '0' : `${value > 0 ? '+' : '−'}${Number(Math.abs(value).toFixed(4))}`;
const tone = (value: number) => value > 0.0005 ? 'good' : value < -0.0005 ? 'bad' : 'flat';
const toneWords = { good: 'improves', bad: 'lowers', flat: 'no change' } as const;

/** One signed value drawn as a bar growing left (worse) or right (better) from a centre line. */
export function DeltaBar({ label, value, scale, strong }: { label: string; value: number; scale: number; strong?: boolean }) {
  const t = tone(value);
  const size = Math.min(1, Math.abs(value) / (scale || 1));
  return <div className={`delta-row${strong ? ' delta-strong' : ''}`} data-tone={t} title={`${label}: ${exact(value)}`}>
    <span className="delta-label">{label}</span>
    <span className="delta-track" aria-hidden="true"><i style={{ '--size': `${t === 'flat' ? 0 : Math.max(size, 0.04) * 50}%` } as CSSProperties} /></span>
    <b className="delta-value">{shortSigned(value)}<span className="sr-only"> (exact {exact(value)}, {toneWords[t]})</span></b>
  </div>;
}

export interface Ongoing { mood: { supplies: number; connection: number; tension: number; net: number; after: number }; energy: { value: number; after: number }; belonging: { value: number; after: number } }

const peak = (...values: number[]) => Math.max(...values.map(Math.abs), 0.01);

export function OngoingEffects({ mood, energy, belonging }: Ongoing) {
  const moodScale = peak(mood.supplies, mood.connection, mood.tension, mood.net);
  return <div className="delta-groups">
    <section aria-label="Mood effects"><h5>Mood</h5>
      <DeltaBar label="Supplies" value={mood.supplies} scale={moodScale} />
      <DeltaBar label="Belonging" value={mood.connection} scale={moodScale} />
      <DeltaBar label="House tension" value={mood.tension} scale={moodScale} />
      <DeltaBar label="Net pressure" value={mood.net} scale={moodScale} strong />
      <small>Change after 0–100 limits: {shortSigned(mood.after)}</small>
    </section>
    <section aria-label="Energy effects"><h5>Energy</h5>
      <DeltaBar label="Net pressure" value={energy.value} scale={peak(energy.value)} strong />
      <small>Change after 0–100 limits: {shortSigned(energy.after)}</small>
    </section>
    <section aria-label="Belonging effects"><h5>Belonging</h5>
      <DeltaBar label="Net pressure" value={belonging.value} scale={peak(belonging.value)} strong />
      <small>Change after 0–100 limits: {shortSigned(belonging.after)}</small>
    </section>
  </div>;
}

export interface Change { eventId: number; minute: number; cause: string; mood: number; energy: number; belonging: number }

export function RecentChanges({ changes, time }: { changes: Change[]; time: (minute: number) => string }) {
  return <ul className="resident-state-events">{changes.map(c => {
    const none = c.mood === 0 && c.energy === 0 && c.belonging === 0;
    return <li key={c.eventId}>
      <strong>{c.cause}</strong><small>{time(c.minute)}</small>
      <div className="delta-chips">
        {([['Mood', c.mood], ['Energy', c.energy], ['Belonging', c.belonging]] as const).map(([label, v]) =>
          <span key={label} className="delta-chip" data-tone={tone(v)} title={`${label}: ${exact(v)}`}>{label} <b>{shortSigned(v)}</b><span className="sr-only"> (exact {exact(v)}, {toneWords[tone(v)]})</span></span>)}
      </div>
      {none && <small>No direct change to these values.</small>}
    </li>;
  })}</ul>;
}
