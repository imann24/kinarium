import { describe, expect, it } from 'vitest';
import { createWorld, relationship, step } from '../src/simulation/engine';
import { advanceConversations, beginConversation, interruptConversations } from '../src/simulation/conversations';
import { contactWillingness, finishRepair, repairScene } from '../src/simulation/repair';
import { applyConversationPlan } from '../src/server/conversation-policy';

function fixture(seed = 42) {
  const world = createWorld({ slug: 'repair', name: 'Repair', populationCap: 2 }, 0, seed);
  const [a, b] = world.characters;
  a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
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
  it('restores wellbeing only after completed repair and records the outcome for future dialogue', () => {
    const { world, a, b, r } = conflictFixture(); world.minute += 120;
    const before = { belonging: a.belonging, mood: a.mood, tension: world.tension };
    const offer = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!);
    expect(offer.conversation!.turns[0].text).toMatch(/tension|tense/);
    finishRepair(world, offer, false);
    expect(a.belonging).toBe(before.belonging);
    finish(world);
    expect(a.belonging).toBe(before.belonging + 1); expect(b.belonging).toBe(a.belonging);
    expect(a.mood).toBe(before.mood + 1); expect(world.tension).toBe(before.tension - .5);
    expect(r.unresolvedConflict).toBeDefined();
    expect(a.stateChanges?.at(-1)).toMatchObject({ cause: 'Repair: tension acknowledged', eventId: offer.id, belonging: 1 });
    expect(a.memories[0].text).toContain('mood and belonging improve');
    const trust = r.trust;
    finishRepair(world, offer, false); expect(r.trust).toBe(trust); expect(a.belonging).toBe(before.belonging + 1);
    world.minute += 120;
    const action = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!); finish(world);
    expect(a.belonging).toBe(before.belonging + 4); expect(world.tension).toBe(before.tension - 2.5);
    expect(a.stateChanges?.at(-1)?.eventId).toBe(action.id); expect(r.unresolvedConflict).toBeUndefined();
  });
  it('does not reward refusal and interrupted offers with wellbeing or house relief', () => {
    const { world, a, b, r } = conflictFixture();
    const before = { belonging: a.belonging, mood: a.mood, tension: world.tension };
    for (const interrupted of [false, true]) {
      world.minute += 120;
      const entry = beginConversation(world, a, b, true, repairScene(world, a, b, r, interrupted ? 0 : .99)!);
      if (interrupted) interruptConversations(world, a.id); else finish(world);
      expect(a.belonging).toBe(before.belonging); expect(a.mood).toBe(before.mood); expect(world.tension).toBe(before.tension);
      expect(r.unresolvedConflict).toBeDefined(); expect(r.repairCommitment).toBeUndefined();
      expect(a.memories[0].tone).toBe('neutral'); expect(repairScene(world, a, b, r, 0)).toBeUndefined();
      expect(entry.text).toContain(interrupted ? 'no trust or wellbeing restored' : 'trust is unchanged');
    }
  });
  it('makes acceptance depend on both residents, prior trust, affinity and current tension', () => {
    const { world, a, b, r } = conflictFixture(); world.minute += 120;
    Object.assign(r, { trust: 80, affinity: 40 }); a.trait = b.trait = 'kind'; world.tension = 10;
    expect(repairScene(world, a, b, r, .6)?.repair.accepted).toBe(true);
    a.mood = 0; a.trait = 'reserved';
    expect(repairScene(world, a, b, r, .6)?.repair.accepted).toBe(false);
    a.mood = 75; a.trait = 'kind'; Object.assign(r, { trust: 5, affinity: -50 }); world.tension = 80;
    expect(repairScene(world, a, b, r, .6)?.repair.accepted).toBe(false);
    expect(repairScene(world, a, b, r, .01)?.repair.accepted).toBe(true);
  });
  it('does not let warm conversation loops restore unresolved trust or repeatedly grant wellbeing', () => {
    const { world, a, b, r } = conflictFixture();
    let warm = 0, throttled = 0;
    for (let i = 0; i < 300; i++) {
      // Keep the pair together and defer a repair attempt to isolate ordinary contact.
      a.x = b.x = 10; a.floor = b.floor = a.destination = b.destination = 0;
      a.inElevator = b.inElevator = false; a.energy = b.energy = 75;
      r.lastRepairMinute = world.minute;
      const previousId = world.nextLog, trust = r.trust, lastReward = r.lastConnectionMinute;
      step(world);
      const entry = world.history.find(e => e.id >= previousId && e.conversation?.tone === 'warm');
      if (!entry) continue;
      warm++;
      expect(entry.conversation?.repair).toBeUndefined(); expect(r.trust).toBe(trust);
      expect(r.unresolvedConflict).toBeDefined();
      const change = a.stateChanges?.find(c => c.eventId === entry.id)!;
      expect(change.belonging).toBeLessThanOrEqual(.5);
      if (world.minute - (lastReward ?? -Infinity) < 120) {
        throttled++; expect(change.belonging).toBe(0); expect(change.mood).toBe(0);
      }
    }
    expect(warm).toBeGreaterThan(1); expect(throttled).toBeGreaterThan(0);
  });
  it('rejects a stale completed plan when a newer conflict or an existing commitment supersedes it', () => {
    for (const superseded of ['conflict', 'commitment'] as const) {
      const { world, a, b, r } = conflictFixture(); world.minute += 120;
      const offer = beginConversation(world, a, b, true, repairScene(world, a, b, r, 0)!);
      // Reveal all replies, but change the persisted relationship before completion.
      for (let i = 0; i < 3; i++) { world.minute += 6; advanceConversations(world); }
      if (superseded === 'conflict') r.unresolvedConflict = { id: 999, minute: world.minute, topic: 'A newer disagreement' };
      else r.repairCommitment = { conflictId: offer.conversation!.repair!.conflictId, initiatorId: a.id };
      const trust = r.trust, belonging = a.belonging;
      finish(world); expect(r.trust).toBe(trust); expect(a.belonging).toBe(belonging);
      expect(r.repairedConflictId).toBeUndefined();
    }
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
