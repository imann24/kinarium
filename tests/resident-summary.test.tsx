import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/simulation/engine';
import { buildResidentSummary } from '../src/simulation/resident-summary';
import type { LogEntry, Memory } from '../src/simulation/types';
import PersonalHistory from '../src/client/PersonalHistory';

function fixture() {
  const world = createWorld({ slug: 'summary', name: 'Summary' }, 0, 42);
  const resident = world.characters[0]; resident.memories = [];
  const add = (id: number, kind: Memory['kind'], minute = 500 + id, extra: Partial<Memory> = {}) => {
    const memory: Memory = { eventId: id, kind, text: `Original memory ${id}`, minute, participantIds: ['c2'], tone: kind === 'conflict' ? 'tense' : 'warm', salience: kind === 'friendship' ? 5 : 3, ...extra };
    resident.memories.unshift(memory); return memory;
  };
  const summarize = (events: LogEntry[] = [], minute = 600) => buildResidentSummary(resident, world.characters, events, minute);
  return { world, resident, add, summarize };
}

describe('compact resident history', () => {
  it('keeps every claim traceable, bounds prose and does not mutate source records', () => {
    const { resident, add, summarize } = fixture();
    add(1, 'arrival', 480, { participantIds: [] }); add(2, 'friendship'); add(3, 'event'); add(4, 'ritual'); add(5, 'departure'); add(6, 'conflict');
    const before = structuredClone(resident); const result = summarize();
    expect(result.story.length).toBeLessThanOrEqual(2);
    expect(result.story.map(e => e.text).join(' ').split(/\s+/).length).toBeLessThanOrEqual(40);
    expect(result.defining.length).toBeLessThanOrEqual(3);
    expect(new Set(result.defining.map(e => e.kind)).size).toBe(result.defining.length);
    for (const episode of [...result.story, ...result.defining, result.tension!]) {
      expect(episode.sourceEventIds.length).toBeGreaterThan(0);
      expect(episode.memories.every(m => resident.memories.includes(m))).toBe(true);
    }
    expect(resident).toEqual(before);
  });
  it('groups consecutive repeated episodes but preserves chronology and tonal changes', () => {
    const { add, summarize } = fixture();
    add(1, 'conversation'); add(2, 'conversation'); add(3, 'conflict'); add(4, 'conversation');
    const result = summarize();
    expect(result.timeline.map(e => e.sourceEventIds)).toEqual([[4], [3], [1, 2]]);
    expect(result.timeline[2].text).toContain('2 times');
    expect(result.tension).toBeUndefined(); // A later conversation supersedes the recent-tension slot, not a claim of reconciliation.
    expect(result.defining.some(e => e.sourceEventIds.includes(3))).toBe(true);
  });
  it('does not duplicate highlights or promote repeated ordinary encounters into defining moments', () => {
    const { add, summarize } = fixture();
    add(1, 'arrival', 480, { participantIds: [] });
    add(2, 'friendship'); add(3, 'friendship');
    add(4, 'conversation', 510, { salience: 1 }); add(5, 'conversation', 550, { salience: 1 });
    const result = summarize();
    const shown = [...result.story, ...result.defining, ...(result.tension ? [result.tension] : [])];
    expect(new Set(shown.map(e => e.signature)).size).toBe(shown.length);
    expect(new Set(shown.map(e => e.text)).size).toBe(shown.length);
    expect(result.defining.some(e => e.kind === 'conversation')).toBe(false);
  });
  it('preserves legacy and empty histories without inferring facts from free text', () => {
    const { resident, summarize } = fixture();
    expect(summarize()).toEqual({ story: [], defining: [], tension: undefined, timeline: [] });
    resident.memories = [{ text: 'Someone promised a reconciliation.', minute: 200 }];
    const result = summarize(); expect(result.story).toEqual([]); expect(result.defining).toEqual([]); expect(result.tension).toBeUndefined();
    expect(result.timeline[0].memories[0].text).toBe('Someone promised a reconciliation.');
    expect(result.timeline[0].sourceEventIds).toEqual([]);
  });
  it('uses completed revealed experience, excludes future and contradicted provenance, never reads planned replies', () => {
    const { resident, add, summarize } = fixture();
    add(1, 'conversation'); add(2, 'conversation'); add(3, 'conversation', 900); add(4, 'conversation');
    const thread = { topic: 'The common table', tone: 'warm' as const, status: 'finished' as const, turns: [{ speakerId: resident.id, text: 'A revealed line.', minute: 501 }], nextTurnAt: 700, targetTurns: 6, planned: [{ speakerId: 'c2', text: 'SECRET UNREVEALED PROMISE' }] };
    const events: LogEntry[] = [
      { id: 1, minute: 501, kind: 'conversation', characters: [resident.id, 'c2'], text: 'They talked.', conversation: thread },
      { id: 2, minute: 502, kind: 'conversation', characters: [resident.id, 'c2'], text: 'They talk.', conversation: { ...thread, status: 'active' } },
      { id: 4, minute: 504, kind: 'conversation', characters: ['c2', 'c3'], text: 'Elsewhere.' },
    ];
    const result = summarize(events);
    expect(result.timeline.flatMap(e => e.sourceEventIds)).toEqual([1]);
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(result.story[0].text).toContain('the common table');
  });
  it('limits recent tension to a recent recorded disagreement without claiming unresolved matters', () => {
    const { add, summarize } = fixture(); add(1, 'conflict'); add(2, 'conflict', 520, { participantIds: ['c3'] });
    expect(summarize().tension?.sourceEventIds).toEqual([2]);
    expect(summarize([], 3000).tension).toBeUndefined();
    expect(JSON.stringify(summarize())).not.toMatch(/unresolved|reconciled|forgave/);
  });
  it('keeps the word budget even with unusually wordy names and topics', () => {
    const { world, add, summarize } = fixture(); world.characters[1].name = 'a '.repeat(15).trim(); add(1, 'friendship');
    expect(summarize().story.map(e => e.text).join(' ').split(/\s+/).length).toBeLessThanOrEqual(40);
  });
  it('renders collapsed native disclosures and preserves original dialogue one level inside the timeline', () => {
    const { world, resident, add } = fixture(); add(1, 'conversation', 500, { text: 'I talked with Juniper. Juniper: “Revealed words.”' });
    const html = renderToStaticMarkup(<PersonalHistory character={resident} characters={world.characters} onSelect={() => {}} minute={600} events={[]}/>);
    expect(html).toContain('Story so far'); expect(html).toContain('Read retained history');
    expect(html).toContain('Read original memory and revealed dialogue'); expect(html).toContain('Revealed words.');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:[\s=>])/);
  });
});
