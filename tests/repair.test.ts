import { describe, expect, it } from 'vitest';
import { createWorld, relationship, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation, interruptConversations } from '../src/simulation/conversations';
import { contactWillingness, repairScene } from '../src/simulation/repair';
import { applyConversationPlan } from '../src/server/conversation-policy';

function fixture(seed = 42) {
  const world = createWorld({ slug: 'repair', name: 'Repair', populationCap: 2 }, 0, seed);
  const [a, b] = world.characters;
  a.floor = b.floor = a.destination = b.destination = 0;
  a.energy = b.energy = a.mood = b.mood = 75;
  const r = relationship(world, a.id, b.id); r.trust = 5; r.affinity = -20;
  return { world, a, b, r };
}
function finish(world: ReturnType<typeof createWorld>) {
  for (let i = 0; i < 8; i++) { world.minute += 6; advanceConversations(world); }
}
function conflictFixture() {
  const f = fixture(); beginConversation(f.world, f.a, f.b, false); finish(f.world); return f;
}
describe('distrust and repair', () => {
  it('reduces actual encounters across seeded worlds without isolating every distrusted pair', () => {
    const totals = [0, 0];
    for (let seed = 1; seed <= 30; seed++) for (const [index, trust] of [0, 80].entries()) {
      const { world, r } = fixture(seed); r.trust = trust;
      for (let tick = 0; tick < 180; tick++) step(world);
      totals[index] += r.encounters;
    }
    console.log('Seeded encounters, distrust/trust:', totals);
    expect(totals[0]).toBeGreaterThan(0); expect(totals[0]).toBeLessThan(totals[1] * .6);
  });
  it('keeps strangers distinct from distrust and weights trusted partner selection more strongly', () => {
    const { r } = fixture(); expect(contactWillingness(r)).toBeLessThan(.25);
    r.trust = 30; expect(contactWillingness(r)).toBeGreaterThan(.6);
    r.trust = 80; expect(contactWillingness(r)).toBe(1);
  });
  it('requires real conflict and cooling time; completes a modest offer then a later action', () => {
    const { world, a, b, r } = fixture();
    expect(repairScene(world, a, b, r, 0)).toBeUndefined();
    const conflict = beginConversation(world, a, b, false); finish(world);
    expect(repairScene(world, a, b, r, 0)).toBeUndefined();
    world.minute += 120;
    const scene = repairScene(world, a, b, r, 0)!;
    expect(scene.lines[0]).toContain(conflict.conversation!.topic.toLowerCase());
    const offer = beginConversation(world, a, b, true, scene);
    expect(applyConversationPlan(offer, 1, [{ speakerId: b.id, text: 'All forgiven!' }])).toBe(false);
    expect(r.trust).toBe(5); finish(world); expect(r.trust).toBe(6);
    expect(repairScene(world, a, b, r, 0)).toBeUndefined();
    world.minute += 120;
    expect(repairScene(world, b, a, r, 0)).toBeUndefined();
    const action = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!);
    expect(action.conversation!.repair!.phase).toBe('follow-through');
    finish(world); expect(r.trust).toBe(13); expect(r.affinity).toBeLessThan(0);
    expect(repairScene(world, a, b, r, 0)).toBeUndefined();
    expect(a.memories[0].text).toContain('I’ll wait and listen');
    expect(action.text).toContain('rebuilds some trust');
  });
  it('respects refusal, interruption and new conflict without awarding unperformed actions', () => {
    const { world, a, b, r } = conflictFixture(); world.minute += 120;
    const rejected = beginConversation(world, a, b, true, repairScene(world, a, b, r, .99)!);
    finish(world); expect(r.trust).toBe(5); expect(r.repairCommitment).toBeUndefined();
    expect(rejected.text).toContain('trust is unchanged');
    world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!);
    interruptConversations(world, a.id); expect(r.trust).toBe(5); expect(r.repairCommitment).toBeUndefined();
    world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    expect(r.repairCommitment).toBeDefined();
    beginConversation(world, a, b, false); finish(world); expect(r.repairCommitment).toBeUndefined();
  });
  it('preserves pending repair across serialization and archived history', () => {
    const { world, a, b, r } = conflictFixture(); world.minute += 120;
    beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    world.history = []; world.minute += 120;
    const saved = JSON.parse(JSON.stringify(world));
    expect(repairScene(saved, saved.characters[0], saved.characters[1], saved.relationships['c1:c2'], 0)?.repair.phase).toBe('follow-through');
  });
  it('achieves repair autonomously over time in seeded strained pairs', () => {
    let repaired = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { world, a, b, r } = fixture(seed);
      a.trait = b.trait = 'kind';
      beginConversation(world, a, b, false); finish(world);
      for (let tick = 0; tick < 2160 && !r.repairedConflictId; tick++) step(world);
      if (r.repairedConflictId) repaired++;
    }
    console.log('Autonomous repair within three days:', repaired, '/ 20');
    expect(repaired).toBeGreaterThanOrEqual(10);
  });
});
