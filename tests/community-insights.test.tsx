import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, relationship } from '../src/simulation/engine';
import type { LogEntry } from '../src/simulation/types';
import { bondKind, communityInsights, pairRecords, recentActivity } from '../src/client/community-insights';
import CommunityInsights from '../src/client/CommunityInsights';

const world = (populationCap = 3) => createWorld({ slug: 'insights', name: 'Insights', populationCap }, 0, 42);
const entry = (id: number, minute: number, kind: LogEntry['kind'] = 'conversation', characters = ['c1', 'c2']): LogEntry => ({ id, minute, kind, characters, text: `Moment ${id}` });

describe('community insight calculations', () => {
  it('uses each resident once and each met pair once, excluding away residents by default', () => {
    const w = world();
    w.characters[0].mood = 20; w.characters[1].mood = 80; w.characters[2].mood = 100;
    w.characters[0].belonging = 10; w.characters[1].belonging = 50; w.characters[2].belonging = 90;
    w.characters[2].away = true;
    Object.assign(relationship(w, 'c1', 'c2'), { encounters: 4, trust: 60, affinity: 40 });
    Object.assign(relationship(w, 'c1', 'c3'), { encounters: 7, trust: 20, affinity: -30 });
    const before = structuredClone(w);
    const home = communityInsights(w);
    expect(home).toMatchObject({ mood: 50, belonging: 30, trust: 60, possiblePairs: 1, encounters: 4, close: 1, strained: 0, notMet: 0 });
    const all = communityInsights(w, 'all');
    expect(all).toMatchObject({ belonging: 50, trust: 40, possiblePairs: 3, encounters: 11, close: 1, strained: 1, notMet: 1 });
    expect(all.mood).toBeCloseTo(200 / 3);
    expect(all.residentDetails.map(c => c.met)).toEqual([2, 1, 1]);
    expect(w).toEqual(before);
  });
  it('does not mistake shared-event score changes for encounters or friendships', () => {
    const w = world();
    applyCommand(w, { type: 'trigger-event', eventId: 'shared-meal' }, 1000);
    const r = relationship(w, 'c1', 'c2'); r.affinity = 80;
    expect(bondKind(r)).toBe('unmet');
    expect(communityInsights(w)).toMatchObject({ trust: null, encounters: 0, notMet: 3 });
    r.encounters = 1;
    for (const [affinity, kind] of [[35, 'forming'], [35.1, 'close'], [-20, 'forming'], [-20.1, 'strained']] as const) {
      r.affinity = affinity; expect(bondKind(r)).toBe(kind);
    }
  });
  it('handles empty, single-resident, and away-only communities without invented zeros', () => {
    const w = world(1);
    expect(communityInsights(w)).toMatchObject({ possiblePairs: 0, trust: null, notMet: 0 });
    w.characters[0].away = true;
    expect(communityInsights(w)).toMatchObject({ mood: null, belonging: null, trust: null, possiblePairs: 0 });
    w.characters = []; w.relationships = {};
    expect(communityInsights(w, 'all').residents).toEqual([]);
  });
  it('ignores dangling relationships and sorts belonging without changing resident order', () => {
    const w = world(); w.characters[1].belonging = 0;
    w.relationships.bad = { a: 'c1', b: 'missing', affinity: 90, trust: 90, encounters: 50, lastMinute: 480 };
    expect(communityInsights(w).bonds).toHaveLength(3);
    expect(communityInsights(w).residentDetails[0].character.id).toBe('c2');
    expect(w.characters[0].id).toBe('c1');
  });
});

describe('retained journal activity', () => {
  it('counts adjacent boundaries once, separates conflict, and excludes milestones and duplicates', () => {
    const w = world(); w.minute = 1000;
    w.history = [entry(1, 640, 'world'), entry(2, 641), entry(3, 760), entry(4, 761, 'conflict'), entry(5, 880), entry(6, 881), entry(7, 1000, 'conflict'), entry(8, 1000, 'friendship'), entry(9, 1001), entry(2, 641)];
    const result = recentActivity(w);
    expect(result.buckets.map(b => [b.conversations, b.conflicts, b.partial])).toEqual([[2, 0, false], [1, 1, false], [1, 1, false]]);
    expect(result.truncated).toBe(false);
  });
  it('marks windows before retained history and supports missing history', () => {
    const w = world(); w.minute = 1000; w.history = [entry(50, 900)];
    const result = recentActivity(w);
    expect(result.truncated).toBe(true);
    expect(result.buckets.every(b => b.partial)).toBe(true);
    w.history = [];
    expect(recentActivity(w)).toMatchObject({ earliest: null, entries: [] });
  });
  it('limits pair evidence to their own interpersonal records', () => {
    const entries = [entry(1, 500), entry(2, 502, 'conflict', ['c1','c3']), entry(3, 504, 'event'), entry(4, 504, 'friendship')];
    expect(pairRecords(entries, 'c1', 'c2').map(e => e.id)).toEqual([4, 1]);
  });
});

describe('community insights rendering', () => {
  it('renders real values, scope control, connection drill-down controls and honest coverage labels', () => {
    const w = world(); w.characters.forEach(c => { c.belonging = 42; });
    const html = renderToStaticMarkup(<CommunityInsights world={w} onSelectResident={() => {}}/>);
    expect(html).toContain('42/100'); expect(html).toContain('Everyone, including away');
    expect(html).toContain('aria-pressed="false"'); expect(html).toContain('up to 80 entries');
    expect(html).toContain('score trends are unavailable'); expect(html).toContain('<caption>');
  });
  it('renders useful empty states without NaN, Infinity or fake statistics', () => {
    const w = world(); w.characters.forEach(c => { c.away = true; }); w.history = [];
    const html = renderToStaticMarkup(<CommunityInsights world={w} onSelectResident={() => {}}/>);
    expect(html).toContain('Nobody is at home'); expect(html).toContain('No journal records');
    expect(html).toContain('No recorded encounters yet'); expect(html).not.toMatch(/NaN|Infinity/);
  });
});
