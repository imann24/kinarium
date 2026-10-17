import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/simulation/catalog';
import { applyCommand, createWorld, step } from '../src/simulation/engine';
import { communityDrift, communityStats, recordCommunityChange } from '../src/simulation/community-state';
import { communityMetricDetails, signedMetric } from '../src/client/community-metric-details';
import CommunityMetrics from '../src/client/CommunityMetrics';

const fixture = () => createWorld({ slug: 'metrics', name: 'Metrics', populationCap: 2 }, 0, 42);
describe('community score explanations', () => {
  it('uses actual population, production, scarcity and bounds, with away residents excluded', () => {
    const world = fixture(); const [a, b] = world.characters;
    Object.assign(a, { trait: 'practical', floor: 2 }); b.away = true;
    world.resources = 19.95;
    const drift = communityDrift(world);
    expect(drift).toMatchObject({ population: 1, producers: 1, consumption: .008, production: .12, scarcity: false });
    expect(drift.next.resources).toBeCloseTo(20.062);
    const resources = communityMetricDetails(world, 'resources');
    expect(resources.current.join(' ')).toContain('1 residents at home use −0.008');
    expect(resources.current.join(' ')).toContain('+0.112 per step');
    expect(communityMetricDetails(world, 'tension').current.join(' ')).toContain('no pressure');
    world.resources = 1; world.tension = 100; world.cohesion = 0;
    expect(communityDrift(world).next).toMatchObject({ tension: 100, cohesion: 0 });
    expect(communityMetricDetails(world, 'tension').current.join(' ')).toContain('+0.06');
    expect(communityMetricDetails(world, 'tension').current.join(' ')).toContain('limits: 0');
  });
  it('shares the engine’s actual end-of-step formula', () => {
    const world = createWorld({ slug: 'empty', name: 'Empty', populationCap: 1 }, 0, 42);
    world.characters[0].away = true; world.resources = 10;
    const expected = communityDrift(world).next; step(world);
    expect(communityStats(world)).toEqual(expected);
  });
  it('records actual bounded event changes and never invents attribution for legacy journals', () => {
    const world = fixture(); world.resources = 99; world.cohesion = 99; world.tension = 1;
    applyCommand(world, { type: 'trigger-event', eventId: 'care-package' }, 1000);
    expect(world.communityChanges?.[0]).toMatchObject({ cause: 'An unexpected gift', resources: 1, cohesion: 1, tension: -1 });
    expect(communityMetricDetails(world, 'resources').recent[0].eventId).toBe(world.history.at(-1)?.id);
    const saved = JSON.parse(JSON.stringify(world));
    expect(communityMetricDetails(saved, 'resources').recent).toEqual(communityMetricDetails(world, 'resources').recent);
    delete world.communityChanges;
    expect(communityMetricDetails(world, 'resources').recent).toEqual([]);
    expect(communityMetricDetails(world, 'cohesion').meaning).toContain('not an average');
    expect(communityMetricDetails(world, 'tension').meaning).toContain('not a count');
  });
  it.each(EVENTS)('attributes $name through the same player-event path, including future catalog additions', event => {
    const world = fixture(); world.cohesion = world.tension = world.resources = 50;
    applyCommand(world, { type: 'trigger-event', eventId: event.id }, 0);
    for (const metric of ['cohesion', 'tension', 'resources'] as const) {
      const recent = communityMetricDetails(world, metric).recent;
      if (event[metric]) expect(recent[0]).toMatchObject({ cause: event.name, [metric]: event[metric] });
      else expect(recent).toEqual([]);
    }
  });
  it('limits records and filters recent changes by score, time and actual nonzero effects', () => {
    const world = fixture();
    for (let i = 0; i < 50; i++) {
      const before = communityStats(world); world.tension += .01;
      recordCommunityChange(world, before, 'A change', i);
    }
    expect(world.communityChanges).toHaveLength(40);
    expect(communityMetricDetails(world, 'tension').recent).toHaveLength(5);
    expect(communityMetricDetails(world, 'resources').recent).toEqual([]);
    world.minute += 361; expect(communityMetricDetails(world, 'tension').recent).toEqual([]);
  });
  it('keeps three compact, keyboard-operable disclosure buttons and accurate tiny deltas', () => {
    const html = renderToStaticMarkup(<CommunityMetrics world={fixture()}/>);
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3);
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    for (const label of ['Togetherness', 'Tension', 'Shared resources']) expect(html).toContain(label);
    expect(html).not.toContain('Current pressures');
    expect(signedMetric(.008)).toBe('+0.008'); expect(signedMetric(-.06)).toBe('−0.06'); expect(signedMetric(100)).toBe('+100');
  });
});
