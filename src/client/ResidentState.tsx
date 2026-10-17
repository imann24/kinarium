import { gameTime } from '../simulation/engine';
import { residentDrift } from '../simulation/resident-state';
import type { Character, WorldState } from '../simulation/types';
import { OngoingEffects, RecentChanges } from './ResidentDeltas';
import './resident-state.css';

function direction(value: number, pressure: number) {
  if (pressure === 0) return 'Steady';
  if (value === 0 && pressure < 0) return 'At 0 · downward pressure';
  if (value === 100 && pressure > 0) return 'At 100 · upward pressure';
  return pressure > 0 ? 'Rising' : 'Falling';
}
export default function ResidentState({ character: c, world }: { character: Character; world: WorldState }) {
  // The next step increments the clock before applying drift; movement happens afterwards.
  const drift = residentDrift(c, { ...world, minute: world.minute + 2 });
  const recent = (c.stateChanges ?? []).filter(change => change.minute <= world.minute && world.minute - change.minute <= 1440).slice(-3).reverse();
  const moodPressure = drift.supplies + drift.connection + drift.tension;
  return <section className="resident-state" aria-label="What affects these values">
    <h4>What affects these values</h4>
    {c.away ? <p>While away, mood, energy and belonging are paused.</p> : <>
      <p>Between encounters, under current conditions:</p>
      <dl>
        <div><dt>Mood · {direction(c.mood, moodPressure)}</dt><dd>{drift.supplies < 0 ? 'Scarce supplies push mood down' : drift.supplies > .035 ? 'A recent gift doubles the support from supplies' : 'Available supplies support mood'}; {drift.connection < 0 ? 'lower belonging adds downward pressure' : drift.connection > 0 ? 'higher belonging adds support' : 'belonging adds no pressure'}{drift.tension < 0 ? '; house tension pushes down.' : '; no house tension pressure.'}</dd></div>
        <div><dt>Energy · {direction(c.energy, drift.energy)}</dt><dd>{drift.night ? 'Nighttime restores energy.' : c.floor === 1 ? 'Being on the rest floor restores energy.' : 'Daytime outside the rest floor uses energy.'} Energy does not directly change mood.</dd></div>
        <div><dt>Belonging · {direction(c.belonging, -drift.fade)}</dt><dd>{drift.fade ? 'Slowly fades over time' : 'Holding at its floor'}, never below {Math.round(drift.floor)} while {c.name} has the trust they do. Warm encounters, completed repair, evening tea and comfortable quiet company can raise it; disagreements can lower it.</dd></div>
      </dl>
      <details><summary>Ongoing effects in numbers</summary><p>Next 2 simulated minutes, before movement or encounters. Bars point right where a value helps and left where it hurts; values stay within 0–100.</p>
        <OngoingEffects mood={{ supplies: drift.supplies, connection: drift.connection, tension: drift.tension, net: moodPressure, after: drift.next.mood - c.mood }} energy={{ value: drift.energy, after: drift.next.energy - c.energy }} belonging={{ value: -drift.fade, after: drift.next.belonging - c.belonging }} />
      </details>
    </>}
    <details><summary>Recent direct changes{recent.length ? ` · ${recent.length}` : ''}</summary>
      <p>Up to three recorded moments from the past simulated day. These are actual changes after 0–100 limits, separate from ongoing effects.</p>
      {recent.length ? <RecentChanges changes={recent} time={gameTime} /> : <p>No direct changes recorded in this window. Older saves have no backfilled causes.</p>}
    </details>
  </section>;
}
