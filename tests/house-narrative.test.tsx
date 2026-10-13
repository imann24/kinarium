import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/simulation/engine';
import type { LogEntry } from '../src/simulation/types';
import { houseNarrative } from '../src/client/house-narrative';
import HouseNarrative from '../src/client/HouseNarrative';

const fixture = () => { const w = createWorld({ slug: 'narrative', name: 'House', populationCap: 3 }, 0, 42); w.minute = 1000; w.history = []; return w; };
const entry = (id: number, minute: number, kind: LogEntry['kind'], characters = ['c1', 'c2']): LogEntry => ({ id, minute, kind, characters, text: 'Unsupported claim: everyone forgave each other because of the weather.' });

describe('local house narrative', () => {
  it('uses structured evidence, prioritizes salient interactions and never interprets event prose', () => {
    const w = fixture();
    w.history = [entry(1, 700, 'world'), entry(2, 750, 'friendship'), entry(3, 800, 'conflict', ['c2','c3']), entry(4, 999, 'conversation', ['c1','c3'])];
    const result = houseNarrative(w);
    expect(result.moments.map(m => m.id)).toEqual([2, 3]);
    expect(result.moments[0].text).toContain(`${w.characters[0].name} and ${w.characters[1].name}`);
    expect(JSON.stringify(result)).not.toMatch(/forgave|weather|because|resolved|improved/);
    expect(result.coverage).toContain('Missing records or skipped catch-up time');
  });
  it('deduplicates ids, reversed pairs, milestones and conversation turns without mutating the world', () => {
    const w = fixture();
    w.history = [entry(1, 900, 'conversation'), entry(1, 900, 'conversation'), entry(2, 900, 'friendship', ['c2','c1']), entry(3, 901, 'conversation'), entry(4, 902, 'conflict', ['c2','c3'])];
    const before = structuredClone(w);
    expect(houseNarrative(w).moments.map(m => m.id)).toEqual([2, 4]);
    expect(houseNarrative(w)).toEqual(houseNarrative(w));
    expect(w).toEqual(before);
    w.history.reverse();
    expect(houseNarrative(w)).toEqual(houseNarrative(before));
  });
  it('excludes future, out-of-window, unrelated and unknown-participant events', () => {
    const w = fixture();
    w.history = [entry(1, 640, 'friendship'), entry(2, 1001, 'conflict'), entry(3, 900, 'event'), entry(4, 950, 'conflict', ['c1','unknown']), entry(5, 960, 'conversation', ['c1']), entry(6, 1000, 'conversation')];
    expect(houseNarrative(w).moments.map(m => m.id)).toEqual([6]);
    expect(houseNarrative(w).moments[0].text).toContain('is on record');
  });
  it('retains away participants without implying they are home or that a conversation is resolved', () => {
    const w = fixture(); w.characters[1].away = true; w.history = [entry(50, 990, 'conversation')];
    const result = houseNarrative(w);
    expect(result.moments[0].text).toContain(w.characters[1].name);
    expect(result.coverage).toContain('Older entries are outside this snapshot');
    expect(result.moments[0].text).not.toMatch(/finished|resolved|now talking/);
  });
  it('describes current atmosphere at the established thresholds, never metric changes', () => {
    const w = fixture();
    for (const [cohesion, tension, expected] of [[65, 60, 'togetherness is moderate and tension is moderate'], [66, 61, 'togetherness is strong and tension is high'], [40, 30, 'togetherness is low and tension is low']] as const) {
      w.cohesion = cohesion; w.tension = tension;
      expect(houseNarrative(w).atmosphere).toContain(expected);
    }
  });
  it('handles empty, away-only, single-resident and stale-history worlds without inventing inactivity', () => {
    const w = fixture(); w.characters.forEach(c => c.away = true);
    expect(houseNarrative(w).atmosphere).toContain('Nobody is at home');
    expect(houseNarrative(w).coverage).toBe('No journal entries are available yet.');
    expect(houseNarrative(w).empty).toContain('does not mean none occurred');
    w.characters[0].away = false; expect(houseNarrative(w).atmosphere).toContain('One resident');
    w.history = [entry(50, 600, 'conflict')]; expect(houseNarrative(w).moments).toEqual([]);
    w.characters = []; expect(houseNarrative(w).moments).toEqual([]);
  });
  it('renders an accessible short narrative with visible coverage and escaped user names', () => {
    const w = fixture(); w.characters[0].name = '<script>example</script>'; w.history = [entry(50, 900, 'conflict')];
    const html = renderToStaticMarkup(<HouseNarrative world={w}/>);
    expect(html).toContain('aria-labelledby="house-narrative-title"');
    expect(html).toContain('Records may be incomplete');
    expect(html).toContain('<summary>About this reading</summary>');
    expect(html).toContain('Whole house'); expect(html).toContain('statistics filters do not change');
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>');
    expect(html).not.toContain('Unsupported claim'); expect(html).not.toContain('aria-live');
  });
});
