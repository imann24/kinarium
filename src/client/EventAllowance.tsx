import { Clock3 } from 'lucide-react';
import { availableEvents, type PlayerEventBudget } from '../simulation/event-budget';

function countdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function EventAllowance({ budget, now, worldReadyAt }: { budget: PlayerEventBudget; now: number; worldReadyAt: number }) {
  const remaining = availableEvents(budget, now);
  const refills = budget.refillsAt.filter(at => at > now);
  const worldWait = Math.max(0, worldReadyAt - now);
  return <div className={`event-allowance ${remaining === 0 ? 'exhausted' : ''}`}>
    <div className="allowance-summary">
      <span className="allowance-title">Your events <b>{remaining} / {budget.limit} available</b></span>
      <div className="allowance-meter" role="meter" aria-label="Your available events" aria-valuemin={0} aria-valuemax={budget.limit} aria-valuenow={remaining}>
        {Array.from({ length: budget.limit }, (_, i) => {
          const refill = i < remaining ? undefined : refills[i - remaining];
          const progress = refill === undefined ? 100 : Math.max(0, Math.min(100, 100 * (1 - (refill - now) / budget.windowMs)));
          return <span key={i} className={refill === undefined ? 'ready' : ''}><i style={{ width: `${progress}%` }}/></span>;
        })}
      </div>
      <small>{budget.limit} events per {budget.windowMs / 60_000} minutes, in this world</small>
    </div>
    <div className="allowance-timers"><span><Clock3 size={14}/>{refills.length ? <>Next allowance in <b>{countdown(refills[0] - now)}</b></> : 'All your events are ready'}</span><small>{worldWait > 0 ? `World cooldown · ${countdown(worldWait)}` : remaining === 0 ? 'Your allowance is recharging' : 'The world is ready for a new moment'}</small></div>
  </div>;
}
