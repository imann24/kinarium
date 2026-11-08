import { availableEvents, type PlayerEventBudget } from '../simulation/event-budget';
import { countdown } from './event-effects';

export default function EventAllowance({ budget, now }: { budget: PlayerEventBudget; now: number }) {
  const remaining = availableEvents(budget, now);
  const nextRefill = budget.refillsAt.find(at => at > now);
  return <div className="event-budget">
    <div className="event-budget-heading"><span>Your allowance</span><b>{remaining}<span> / {budget.limit} available</span></b></div>
    <div className="event-budget-meter" role="meter" aria-label="Your available events" aria-valuemin={0} aria-valuemax={budget.limit} aria-valuenow={remaining}>
      {Array.from({ length: budget.limit }, (_, i) => <span key={i} className={i < remaining ? 'ready' : ''}/>)}
    </div>
    <small>{nextRefill ? `Next event in ${countdown(nextRefill - now)}` : `${budget.limit} events every ${budget.windowMs / 60_000} minutes`}<span>In this house</span></small>
  </div>;
}
