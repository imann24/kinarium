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

 describe('saved summary refresh policy', () => {
  it('initializes legacy/empty residents, preserves inputs and skips unrelated or unchanged updates', async () => {
    const { refreshResidentSummaries } = await import('../src/simulation/resident-summary');
    const { world, resident } = fixture();
    const memories = structuredClone(resident.memories); const history = structuredClone(world.history);
    refreshResidentSummaries(world, 1000);
    const cached = resident.residentSummary!;
    expect(cached.value.timeline).toEqual([]);
    resident.mood = 1; resident.away = true; world.minute += 2;
    refreshResidentSummaries(world, 100_000);
    expect(resident.residentSummary).toBe(cached);
    expect(resident.memories).toEqual(memories); expect(world.history).toEqual(history);
  });
  it('throttles changes at 60 seconds, including away residents and paused simulation time', async () => {
    const { refreshResidentSummaries } = await import('../src/simulation/resident-summary');
    const { world, resident, add } = fixture(); world.minute = 600;
    refreshResidentSummaries(world, 1000); const cached = resident.residentSummary;
    resident.away = true; add(90, 'friendship');
    refreshResidentSummaries(world, 60_999); expect(resident.residentSummary).toBe(cached);
    refreshResidentSummaries(world, 61_000); expect(resident.residentSummary).not.toBe(cached);
    expect(resident.residentSummary!.value.story[0].text).toContain('friends');
    expect(cached!.value.timeline).toEqual([]);
  });
  it('persists freshness across save/load and catches up once after inactivity', async () => {
    const { refreshResidentSummaries } = await import('../src/simulation/resident-summary');
    const { world, add } = fixture(); world.minute = 600; add(90, 'arrival');
    refreshResidentSummaries(world, 1000);
    const loaded = JSON.parse(JSON.stringify(world)); const cached = loaded.characters[0].residentSummary;
    refreshResidentSummaries(loaded, 1_000_000); expect(loaded.characters[0].residentSummary).toBe(cached);
    loaded.characters[0].memories.push({ text: 'An earlier memory', minute: 100 });
    refreshResidentSummaries(loaded, 1_000_000);
    expect(loaded.characters[0].residentSummary.updatedAt).toBe(1_000_000);
    expect(loaded.characters[0].residentSummary.value.timeline).toHaveLength(2);
  });
  it('refreshes relevant names, provenance and tension expiry but ignores planned dialogue', async () => {
    const { refreshResidentSummaries } = await import('../src/simulation/resident-summary');
    const { world, resident, add } = fixture(); world.minute = 600; add(90, 'conflict');
    refreshResidentSummaries(world, 0); expect(resident.residentSummary!.value.tension).toBeDefined();
    world.characters[1].name = 'Renamed'; refreshResidentSummaries(world, 60_000);
    expect(resident.residentSummary!.value.tension!.text).toContain('Renamed');
    world.minute = 3000; refreshResidentSummaries(world, 120_000);
    expect(resident.residentSummary!.value.tension).toBeUndefined();
    world.history.push({ id: 90, minute: 590, kind: 'conflict', text: 'Talk', characters: [resident.id], conversation: { topic: 'Tea', status: 'active', tone: 'tense', turns: [], nextTurnAt: 600, targetTurns: 3 } });
    refreshResidentSummaries(world, 180_000); expect(resident.residentSummary!.value.timeline).toEqual([]);
    const cached = resident.residentSummary;
    world.history.at(-1)!.conversation!.planned = [{ speakerId: resident.id, text: 'SECRET' }];
    refreshResidentSummaries(world, 240_000); expect(resident.residentSummary).toBe(cached);
    world.history.at(-1)!.conversation!.status = 'finished';
    refreshResidentSummaries(world, 240_000); expect(resident.residentSummary!.value.timeline).toHaveLength(1);
    expect(JSON.stringify(resident.residentSummary)).not.toContain('SECRET');
  });
  it('shows pending freshness and legacy/empty copy without replacing source records', async () => {
    const { refreshResidentSummaries } = await import('../src/simulation/resident-summary');
    const { world, resident, add } = fixture(); world.minute = 600; add(90, 'arrival');
    refreshResidentSummaries(world, 0); add(91, 'friendship');
    const html = renderToStaticMarkup(<PersonalHistory character={resident} characters={world.characters} onSelect={() => {}} minute={world.minute} events={world.history}/>);
    expect(html).toContain('waiting for the next refresh'); expect(html).toContain('real-time minute');
    expect(resident.memories).toHaveLength(2);
  });
});
