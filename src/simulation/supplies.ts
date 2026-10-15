import { recordResidentChange, residentStats } from './resident-state';
import type { Character, LogEntry, WorldState } from './types';

export const SUPPLY_TRIGGER = 35;
export const SUPPLY_ENERGY_MIN = 40;
export const SUPPLY_ENERGY_COST = 10;
export const SUPPLY_DURATION = 16;
export const SUPPLY_COOLDOWN = 180;
export const supplyDemand = (world: WorldState) => world.characters.filter(c => !c.away).length * .008;
// Reserve enough for roughly eight nighttime hours of use, plus the shortage buffer.
export const supplyThreshold = (world: WorldState) => Math.min(95, Math.max(SUPPLY_TRIGGER, Math.ceil(20 + supplyDemand(world) * 240)));
export function needsSupplyWork(world: WorldState, c: Character) {
  const time = world.minute % 1440;
  return !c.away && world.resources < supplyThreshold(world) && c.energy >= SUPPLY_ENERGY_MIN &&
    time >= 360 && time <= 1320 && (c.nextSupplyAt ?? 0) <= world.minute &&
    !world.characters.some(person => !person.away && person.supplyTask);
}
function record(world: WorldState, c: Character, text: string): LogEntry {
  const entry: LogEntry = { id: world.nextLog++, minute: world.minute, kind: 'upkeep', text, characters: [c.id] };
  world.history.push(entry); return entry;
}
/** Runs only for residents outside conversations. Work occupies movement/social time. */
export function advanceSupplyWork(world: WorldState, c: Character) {
  if (c.supplyTask) {
    if (world.minute < c.supplyTask.completeAt) { c.activity = 'replenishing shared supplies'; return true; }
    const added = Math.min(c.supplyTask.amount, 100 - world.resources);
    world.resources += added;
    record(world, c, `${c.name} finishes replenishing shared supplies: +${Number(added.toFixed(2))} supplies. The work used ${SUPPLY_ENERGY_COST} energy and ${SUPPLY_DURATION} simulated minutes.`);
    delete c.supplyTask;
    c.destination = c.energy < SUPPLY_ENERGY_MIN ? 1 : 0;
    c.activity = c.destination === 1 ? 'heading to rest after supply work' : 'returning after supply work';
    return true;
  }
  if (c.inElevator || c.floor !== 2 || c.destination !== 2 || !needsSupplyWork(world, c)) return false;
  const before = residentStats(c);
  c.energy -= SUPPLY_ENERGY_COST;
  c.supplyTask = { startedAt: world.minute, completeAt: world.minute + SUPPLY_DURATION, amount: c.trait === 'practical' ? 10 : 8 };
  c.nextSupplyAt = world.minute + SUPPLY_COOLDOWN;
  c.activity = 'replenishing shared supplies';
  const entry = record(world, c, `${c.name} starts replenishing shared supplies, spending ${SUPPLY_ENERGY_COST} energy. Supplies arrive only when the work finishes.`);
  recordResidentChange(c, before, world.minute, 'Supply work', entry.id);
  return true;
}
