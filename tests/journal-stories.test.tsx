import { describe, expect, it } from 'vitest';
import { createWorld, relationship, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation } from '../src/simulation/conversations';
import { repairScene } from '../src/simulation/repair';
import { REPAIR_ARC_LIMIT, repairArc } from '../src/simulation/relationship-story';
import { foldJournal, highlightLabels, isStoryItem } from '../src/client/journal-stories';
import { houseNarrative } from '../src/client/house-narrative';
import { relationshipNarrative } from '../src/client/relationship-narrative';
import { distressedHouse } from './fixtures/distressed-house';
import type { LogEntry, WorldState } from '../src/simulation/types';

function pair(seed = 42) {
  const world = createWorld({ slug: 'stories', name: 'Stories', populationCap: 2 }, 0, seed);
  const [a, b] = world.characters;
  a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
  a.energy = b.energy = a.mood = b.mood = 75;
  const r = relationship(world, a.id, b.id); r.trust = 5; r.affinity = -20; r.encounters = 3;
  return { world, a, b, r };
}
function finish(world: WorldState) {
  for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); }
}
function quarrel() {
  const f = pair(); beginConversation(f.world, f.a, f.b, false); finish(f.world); return f;
}
/** Three refused bids on one disagreement, newest first as the journal lists them. */
function refusals() {
  const f = quarrel(); f.world.minute += 120;
  const bids: LogEntry[] = [];
  for (const wait of [360, 720, 1440]) {
    bids.push(beginConversation(f.world, f.a, f.b, true, repairScene(f.world, f.a, f.b, f.r, .99)!)); finish(f.world);
    f.world.minute += wait;
  }
  return { ...f, bids, newestFirst: [...f.world.history].sort((x, y) => y.id - x.id) };
}

describe('repair arcs', () => {
  it('records each disagreement’s repair as one arc, through easing to settling', () => {
    const { r, bids } = refusals();
    const arc = r.story!.arcs!.at(-1)!;
    expect(arc).toMatchObject({ conflictId: bids[0].conversation!.repair!.conflictId, attempts: 3, accepted: 0, spaceGiven: 3, state: 'eased', lastEventId: bids[2].id });
    expect(r.goodwill).toBe(3);
  });
  it('keeps only the most recent few arcs', () => {
    const { world, r } = pair();
    for (let id = 1; id <= REPAIR_ARC_LIMIT + 2; id++) repairArc(r, id, `Topic ${id}`, { id, minute: world.minute });
    expect(r.story!.arcs!.map(a => a.conflictId)).toEqual([3, 4, 5]);
  });
});

describe('turning points', () => {
  it('marks the first agreement to try and the completed repair', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120;
    const offer = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    world.minute += 120;
    const done = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    expect(offer.highlight).toBe('first-offer'); expect(done.highlight).toBe('settled');
    expect(r.story!.arcs!.at(-1)!.state).toBe('settled');
  });
  it('marks warmth soon after a refused approach as a turn for the better, once', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)!); finish(world);
    expect(r.lastRefusedMinute).toBeGreaterThan(world.minute - 60);
    const marked: LogEntry[] = [];
    for (let i = 0; i < 400 && !marked.length; i++) {
      a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0; a.inElevator = b.inElevator = false;
      a.energy = b.energy = a.mood = b.mood = 75; r.lastRepairMinute = world.minute;
      const id = world.nextLog; step(world);
      marked.push(...world.history.filter(e => e.id >= id && e.highlight === 'turnaround'));
    }
    expect(marked).toHaveLength(1);
    expect(marked[0].kind).toBe('conversation');
    expect(r.lastRefusedMinute).toBeUndefined();
  });
});

describe('the journal folds repeated attempts', () => {
  it('shows the newest refused attempt with a summary, and the earlier ones beneath it', () => {
    const { world, bids, newestFirst } = refusals();
    const items = foldJournal(newestFirst, world);
    const head = items.find(i => i.entry.id === bids[2].id)!;
    expect(head.earlier.map(e => e.id)).toEqual([bids[1].id, bids[0].id]);
    expect(items.some(i => i.entry.id === bids[0].id)).toBe(false);
    expect(head.summary).toMatch(/^Third attempt about .+: .+ has reached out, and .+’s requests for space were honored 3 times\. Goodwill is easing the disagreement\.$/);
  });
  it('never folds turning points, other disagreements, or an entry the reader opened', () => {
    const { world, bids, newestFirst } = refusals();
    bids[1].highlight = 'first-offer';
    let items = foldJournal(newestFirst, world);
    expect(items.find(i => i.entry.id === bids[1].id)?.earlier).toEqual([]);
    expect(items.find(i => i.entry.id === bids[2].id)?.earlier.map(e => e.id)).toEqual([bids[0].id]);
    items = foldJournal(newestFirst, world, new Set([bids[0].id]));
    expect(items.some(i => i.entry.id === bids[0].id)).toBe(true);
    bids[1].highlight = undefined;
    bids[0].conversation!.repair!.conflictId = 999;
    items = foldJournal(newestFirst, world);
    expect(items.find(i => i.entry.id === bids[2].id)?.earlier.map(e => e.id)).toEqual([bids[1].id]);
  });
  it('keeps turning points, events and repair stories in the Stories view', () => {
    const { world, newestFirst } = refusals();
    const stories = foldJournal(newestFirst, world).filter(isStoryItem);
    expect(stories.every(i => i.entry.conversation?.repair || i.entry.highlight || i.entry.kind === 'event')).toBe(true);
    expect(stories).toHaveLength(1);
    expect(highlightLabels.settled).toBe('Disagreement settled');
  });
  it('does not explain score mechanics in journal text over a long, difficult run', () => {
    const world = distressedHouse(3);
    for (let i = 0; i < 2160; i++) step(world);
    const text = world.history.map(e => e.text).join('\n');
    expect(text).not.toMatch(/no additional recovery|trust is unchanged|trust and the unresolved disagreement are unchanged|no trust or wellbeing restored|mood and belonging improve/);
    expect(world.history.some(e => e.highlight)).toBe(true);
  });
});

describe('summaries lead with stories', () => {
  it('opens the house reading with a recent turning point', () => {
    const { world, a, b, r } = quarrel(); world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    world.minute += 600;
    const moments = houseNarrative(world).moments;
    expect(moments[0]).toMatchObject({ kind: 'turning-point' });
    expect(moments[0].text).toMatch(/settled their disagreement about/);
  });
  it('tells a pair’s repair story in plain words', () => {
    const { r, a, b } = refusals();
    const story = relationshipNarrative(r, a, b).story.join(' ');
    expect(story).toContain('has taken 3 attempts so far, and 3 requests for space were honored. The goodwill between them is easing it.');
  });
});
