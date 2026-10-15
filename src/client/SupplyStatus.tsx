import { gameTime } from '../simulation/engine';
import { supplyDemand, supplyThreshold, SUPPLY_COOLDOWN, SUPPLY_DURATION, SUPPLY_ENERGY_COST, SUPPLY_ENERGY_MIN } from '../simulation/supplies';
import { tensionFlow, supplyMoodEffect, SHORTAGE_LEVEL } from '../simulation/community-dynamics';
import { TEMPLATES } from '../simulation/catalog';
import type { WorldState } from '../simulation/types';
import './supply-status.css';

export default function SupplyStatus({ world }: { world: WorldState }) {
  const threshold = supplyThreshold(world);
  const workers = world.characters.filter(c => !c.away && c.supplyTask);
  const latest = [...world.history].reverse().find(e => e.kind === 'upkeep' && e.minute <= world.minute);
  const shortage = world.resources < SHORTAGE_LEVEL;
  const pressure = tensionFlow(world.resources, world.tension);
  return <section className="supply-status" aria-label="Supplies and resident needs">
    <div className="supply-heading"><h3>Supplies & everyday needs</h3><strong>{Math.floor(world.resources * 100) / 100}/100 · {shortage ? 'Shortage' : world.resources < threshold ? 'Running low' : 'Stocked'}</strong></div>
    <div className="supply-meter" role="progressbar" aria-label={`Shared supplies; shortage below 20, upkeep starts below ${threshold}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={world.resources}>
      <span style={{ width: `${world.resources}%` }}/><i className="shortage-mark"/><i className="upkeep-mark" style={{left:`${threshold}%`}}/>
    </div>
    <div className="supply-scale"><span>0 · empty</span><span>20 · shortage ends</span><span>{Number(threshold.toFixed(1))} · upkeep threshold</span><span>100</span></div>
    <p><strong>{shortage ? 'Shortage → ' : 'Available supplies → '}{shortage ? '−' : '+'}{Math.abs(supplyMoodEffect(world.resources))} mood</strong> per at-home resident every 2 simulated minutes. This is one influence; mood also settles over time and responds to belonging, tension and encounters.</p>
    {workers.map(c => <div className="supply-worker" key={c.id}><strong>{c.name} · replenishing supplies</strong><progress aria-label={`${c.name} supply work`} value={Math.min(SUPPLY_DURATION, world.minute - c.supplyTask!.startedAt)} max={SUPPLY_DURATION}/><span>{Math.max(0, c.supplyTask!.completeAt - world.minute)} simulated minutes left · {SUPPLY_ENERGY_COST} energy spent · up to +{c.supplyTask!.amount} supplies on completion</span></div>)}
    {!workers.length && <p>No supply work in progress.</p>}
    {latest && <p className="supply-latest"><small>Latest recorded upkeep · {gameTime(latest.minute)}</small>{latest.text}</p>}
    <details><summary>How replenishment and recovery work</summary>
      <p>At-home residents use {Number(supplyDemand(world).toFixed(3))} supplies per 2 simulated minutes. Below {Number(threshold.toFixed(1))}, residents with at least {SUPPLY_ENERGY_MIN} energy can head to {TEMPLATES[world.templateId].floors[2].name} during the day. Larger households keep a higher reserve for nighttime use.</p>
      <p>One resident works at a time for {SUPPLY_DURATION} simulated minutes, spending {SUPPLY_ENERGY_COST} energy at the start. A finished task adds 8 supplies, or 10 for practical residents. Each resident waits {SUPPLY_COOLDOWN} simulated minutes before starting again. Low-energy residents rest; leaving interrupts the task without adding supplies.</p>
      {world.characters.some(c => !c.away) ? <p>House tension eases by {Number(pressure.easing.toFixed(4))} per step{shortage ? ', but shortage adds 0.06' : ''}, before encounters and other events. Replenishment removes shortage pressure only once supplies reach 20; it does not reset mood, tension or relationships.</p> : <p>With nobody at home, ongoing tension change is paused.</p>}
    </details>
  </section>;
}
