import { describe, expect, it } from 'vitest';
import { applyCommand, step } from '../src/simulation/engine';
import type { WorldState } from '../src/simulation/types';
import { distressedHouse, healthyHouse } from './fixtures/distressed-house';

const DAY_TICKS = 720;
const SEEDS = 50;

/** Runs a house with no player events and reports how it recovered. */
function run(world: WorldState, days: number) {
  const startId = world.nextLog;
  const open = new Set(Object.values(world.relationships).filter(r => r.unresolvedConflict).map(r => `${r.a}:${r.b}`));
  let recoveredTick: number | undefined, maxTension = 0, minTension = 100, maxCohesion = 0, pinnedTicks = 0, longestPinned = 0, calmTicks = 0, longestCalm = 0;
  for (let tick = 0; tick < days * DAY_TICKS; tick++) {
    step(world);
    if (recoveredTick === undefined && world.tension < 60) recoveredTick = tick;
    if (tick >= DAY_TICKS) { maxTension = Math.max(maxTension, world.tension); minTension = Math.min(minTension, world.tension); maxCohesion = Math.max(maxCohesion, world.cohesion); }
    pinnedTicks = world.tension >= 100 ? pinnedTicks + 1 : 0; longestPinned = Math.max(longestPinned, pinnedTicks);
    calmTicks = world.tension <= 0 ? calmTicks + 1 : 0; longestCalm = Math.max(longestCalm, calmTicks);
  }
  const repairs = world.history.filter(e => e.id >= startId && e.conversation?.repair && e.conversation.status === 'finished');
  const refusals = repairs.filter(e => !e.conversation!.repair!.accepted).length;
  const settled = [...open].filter(key => world.relationships[key].repairedConflictId !== undefined).length;
  // Refused bids on one disagreement in any six-hour window.
  const refused = repairs.filter(e => !e.conversation!.repair!.accepted);
  let crowded = 0;
  for (const e of refused) {
    const sameWindow = refused.filter(o => o.conversation!.repair!.conflictId === e.conversation!.repair!.conflictId && o.minute >= e.minute && o.minute - e.minute < 360);
    crowded = Math.max(crowded, sameWindow.length);
  }
  return { recoveredTick, maxTension, minTension, maxCohesion, longestPinned, longestCalm, attempts: repairs.length, refusals, settled, crowded, tension: world.tension, cohesion: world.cohesion };
}

describe('recovery from a distressed house', () => {
  const results = Array.from({ length: SEEDS }, (_, i) => run(distressedHouse(i + 1), 5));
  const share = (test: (r: typeof results[number]) => boolean) => results.filter(test).length / SEEDS;
  const attempts = results.reduce((n, r) => n + r.attempts, 0), refusals = results.reduce((n, r) => n + r.refusals, 0);
  console.log('Distressed sweep:', JSON.stringify({
    recoveredWithin3Days: share(r => r.recoveredTick !== undefined && r.recoveredTick < 3 * DAY_TICKS),
    medianRecoveryHours: [...results].map(r => r.recoveredTick ?? Infinity).sort((a, b) => a - b)[SEEDS / 2] * 2 / 60,
    settledAny: share(r => r.settled > 0), refusalShare: refusals / Math.max(1, attempts), attempts,
    finalTension: results.reduce((n, r) => n + r.tension, 0) / SEEDS, finalCohesion: results.reduce((n, r) => n + r.cohesion, 0) / SEEDS,
    worstCrowding: Math.max(...results.map(r => r.crowded)),
    minTension: Math.min(...results.map(r => r.minTension)), maxCohesion: Math.max(...results.map(r => r.maxCohesion)), longestCalmHours: Math.max(...results.map(r => r.longestCalm)) / 30,
  }));

  it('brings tension below 60 within three simulated days in most seeds, with no gift', () => {
    expect(share(r => r.recoveredTick !== undefined && r.recoveredTick < 3 * DAY_TICKS)).toBeGreaterThanOrEqual(.8);
  });
  it('does not overshoot into a frictionless house', () => {
    expect(results.every(r => r.maxCohesion < 100 && r.longestCalm < 2 * DAY_TICKS)).toBe(true);
  });
  it('settles at least one disagreement in most seeds, and refusal becomes less common', () => {
    expect(share(r => r.settled > 0)).toBeGreaterThan(.5);
    // Before goodwill, this house refused about 92% of bids.
    expect(refusals / attempts).toBeLessThanOrEqual(.75);
  });
  it('spaces out refused repair attempts on one disagreement', () => {
    // At most one refused bid per conflict in any six simulated hours.
    expect(Math.max(...results.map(r => r.crowded))).toBeLessThanOrEqual(1);
  });
});

describe('a healthy house under strain', () => {
  it('can still deteriorate, but does not stay pinned at full tension for a day', () => {
    let worst = 0, rose = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const world = healthyHouse(seed);
      applyCommand(world, { type: 'trigger-event', eventId: 'rumor' }, 1_000);
      applyCommand(world, { type: 'trigger-event', eventId: 'power-outage' }, 100_000);
      const start = world.tension;
      const result = run(world, 3);
      worst = Math.max(worst, result.longestPinned);
      if (start > 18) rose++;
    }
    console.log('Strained healthy house, longest hours pinned at 100:', worst / 30);
    expect(rose).toBe(20);
    expect(worst).toBeLessThan(DAY_TICKS);
  });
});

describe('an ordinary house left alone', () => {
  it('keeps some friction instead of settling into permanent calm', () => {
    let longestCalm = 0;
    for (let seed = 1; seed <= 20; seed++) longestCalm = Math.max(longestCalm, run(healthyHouse(seed), 3).longestCalm);
    console.log('Ordinary house, longest hours at zero tension:', longestCalm / 30);
    expect(longestCalm).toBeLessThan(DAY_TICKS * 2);
  });
});

describe('gifts and trust', () => {
  it('gives material relief without changing any pair’s trust', () => {
    const world = distressedHouse(1);
    const before = Object.fromEntries(Object.entries(world.relationships).map(([k, r]) => [k, r.trust]));
    applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1_000);
    for (const [k, r] of Object.entries(world.relationships)) expect(r.trust).toBe(before[k]);
    expect(world.reliefUntil).toBeGreaterThan(world.minute);
  });
  it('does not take trust away for a mixed common project', () => {
    const world = healthyHouse(1);
    const before = Object.fromEntries(Object.entries(world.relationships).map(([k, r]) => [k, r.trust]));
    applyCommand(world, { type: 'trigger-event', eventId: 'new-project' }, 1_000);
    for (const [k, r] of Object.entries(world.relationships)) expect(r.trust).toBe(before[k]);
  });
  it('lets a shared meal build trust only between pairs without an open disagreement', () => {
    const world = distressedHouse(1);
    const open = Object.values(world.relationships).find(r => r.unresolvedConflict)!;
    const calm = Object.values(world.relationships).find(r => !r.unresolvedConflict)!;
    const [openTrust, calmTrust] = [open.trust, calm.trust];
    applyCommand(world, { type: 'trigger-event', eventId: 'shared-meal' }, 1_000);
    expect(open.trust).toBe(openTrust); expect(calm.trust).toBe(calmTrust + 1);
  });
});
