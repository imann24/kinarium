import { MEMORY_LIMIT } from '../src/simulation/memories';
import { describe, expect, it } from 'vitest';
import { activeCharacters, advance, applyCommand, createCharacter, createWorld, MAX_CATCHUP_STEPS, MINUTES_PER_TICK, relationship, step, TICK_MS } from '../src/simulation/engine';
import { EVENTS, TEMPLATES } from '../src/simulation/catalog';

const world = (cap = 12) => createWorld({ slug: 'test-house', name: 'Test house', populationCap: cap }, 1_000, 42);
describe('the community engine', () => {
  it.each(Object.values(TEMPLATES))('runs $id through a full day and resumes saved state deterministically', template => {
    const a = createWorld({ slug: 'template-test', name: template.name, templateId: template.id }, 1_000, 42);
    expect(a.version).toBe(1);
    expect(a.characters).toHaveLength(6);
    const b = JSON.parse(JSON.stringify(a));
    const activities = new Set<string>();
    for (let i = 0; i < 720; i++) {
      if (i === 100) {
        createCharacter(a); createCharacter(b);
        applyCommand(a, { type: 'trigger-event', eventId: 'shared-meal' }, 500_000);
        applyCommand(b, { type: 'trigger-event', eventId: 'shared-meal' }, 500_000);
      }
      step(a); step(b);
      expect(a.elevatorFloor).toBeGreaterThanOrEqual(0);
      expect(a.elevatorFloor).toBeLessThan(template.floors.length);
      for (const c of a.characters) {
        expect(template.floors[c.floor]).toBeDefined();
        expect(template.floors[c.destination]).toBeDefined();
        expect(c.activity).toBeTruthy();
        if (c.inElevator) expect(c.floor).toBe(a.elevatorFloor);
        activities.add(c.activity);
      }
    }
    expect(a).toEqual(b);
    expect(a.history.some(e => e.kind === 'ritual')).toBe(true);
    expect(Object.values(a.relationships).some(r => r.encounters > 0)).toBe(true);
    for (const floor of template.floors) if (floor.activity) expect(activities.has(floor.activity)).toBe(true);
    for (const metric of [a.cohesion, a.tension, a.resources]) {
      expect(Number.isFinite(metric)).toBe(true);
      expect(metric).toBeGreaterThanOrEqual(0); expect(metric).toBeLessThanOrEqual(100);
    }
  });
  it('preserves the original default and gives the new templates different community conditions', () => {
    const common = world();
    expect(common.templateId).toBe('common-house');
    expect([common.cohesion, common.tension, common.resources]).toEqual([62, 18, 75]);
    const makers = createWorld({ slug: 'makers', name: 'Makers', templateId: 'makers-house' }, 1_000, 42);
    const harbor = createWorld({ slug: 'harbor', name: 'Harbor', templateId: 'harbor-house' }, 1_000, 42);
    expect(makers.resources).toBeGreaterThan(common.resources);
    expect(makers.tension).toBeGreaterThan(common.tension);
    expect(harbor.cohesion).toBeGreaterThan(common.cohesion);
    expect(harbor.resources).toBeLessThan(common.resources);
    advance(makers, 601_000); advance(harbor, 601_000);
    expect(makers.relationships).not.toEqual(harbor.relationships);
  });
  it('is deterministic and survives serialization without diverging', () => {
    const a = world(); const b = JSON.parse(JSON.stringify(a));
    advance(a, 601_000); advance(b, 601_000); expect(a).toEqual(b);
    expect(Object.values(a.relationships).some(r => r.encounters > 0)).toBe(true);
  });
  it('handles retried alarms and preserves a fractional tick', () => {
    const a = world(); advance(a, 1_000 + TICK_MS * 3 + 700); const saved = structuredClone(a);
    advance(a, 1_000 + TICK_MS * 3 + 700); expect(a).toEqual(saved);
    expect(a.lastTickAt).toBe(1_000 + TICK_MS * 3); advance(a, 1_000 + TICK_MS * 4); expect(a.minute).toBe(480 + 4 * MINUTES_PER_TICK);
  });
  it('bounds long catch-up work while preserving elapsed game time', () => {
    const a = world(); const count = advance(a, 1_000 + TICK_MS * 100_000);
    expect(count).toBe(MAX_CATCHUP_STEPS); expect(a.minute).toBe(480 + 100_000 * MINUTES_PER_TICK);
    expect(a.history.some(e => e.text.includes('long quiet interval'))).toBe(true);
  });
  it('keeps away residents and memories, excludes them from cap and encounters', () => {
    const a = world(6); const id = a.characters[0].id;
    expect(() => createCharacter(a)).toThrow('full');
    applyCommand(a, { type: 'set-away', characterId: id, away: true }, 1_000);
    const memories = structuredClone(a.characters[0].memories);
    const encounters = Object.values(a.relationships).filter(r => r.a === id || r.b === id).map(r => r.encounters);
    createCharacter(a, 'New neighbor'); advance(a, 501_000);
    expect(activeCharacters(a)).toHaveLength(6); expect(a.characters[0].memories).toEqual(memories);
    expect(Object.values(a.relationships).filter(r => r.a === id || r.b === id).slice(0,5).map(r => r.encounters)).toEqual(encounters);
    expect(() => applyCommand(a, { type: 'set-away', characterId: id, away: false }, 2_000)).toThrow('full');
    applyCommand(a, { type: 'settings', mode: 'persistent', populationCap: 7 }, 2_000);
    applyCommand(a, { type: 'set-away', characterId: id, away: false }, 2_000); expect(a.characters[0].away).toBe(false);
  });
  it('uses one shared cooldown across all events and retains meaningful relationship effects', () => {
    const a = world(); const start = a.cohesion;
    applyCommand(a, { type: 'trigger-event', eventId: 'shared-meal' }, 1_000);
    expect(a.cohesion).toBeGreaterThan(start); expect(relationship(a, 'c1', 'c2').trust).toBeGreaterThan(30);
    expect(() => applyCommand(a, { type: 'trigger-event', eventId: 'rumor' }, 1_001)).toThrow('settle');
    applyCommand(a, { type: 'trigger-event', eventId: 'rumor' }, 46_000); expect(a.tension).toBeGreaterThan(18);
  });
  it('only boards and exits during a stopped tick, with a full travel tick in between', () => {
    const a = world(1); const c = a.characters[0]; c.floor = 1; c.destination = 2; c.x = 94;
    step(a); expect(a.elevatorPhase).toBe('moving'); expect(c.inElevator).toBeFalsy();
    step(a); expect(a.elevatorPhase).toBe('stopped'); expect(c.inElevator).toBe(true); expect(c.floor).toBe(1);
    step(a); expect(a.elevatorPhase).toBe('moving'); expect(c.floor).toBe(2); expect(c.inElevator).toBe(true);
    step(a); expect(a.elevatorPhase).toBe('stopped'); expect(a.elevatorFloor).toBe(2); expect(c.inElevator).toBe(false);
    expect(c.activity).toBe('stepping out of the elevator');
  });
  it('resumes older persisted elevator state and keeps all riders on the cabin floor', () => {
    const a = world(1); delete a.elevatorPhase;
    const c = a.characters[0]; c.floor = 0; c.destination = 2; c.inElevator = true;
    for (let i = 0; i < 20; i++) {
      const priorFloor = a.elevatorFloor;
      step(a);
      if (a.elevatorPhase === 'stopped') expect(a.elevatorFloor).toBe(priorFloor);
      if (c.inElevator) expect(c.floor).toBe(a.elevatorFloor);
      expect(a.elevatorFloor).toBeGreaterThanOrEqual(0); expect(a.elevatorFloor).toBeLessThanOrEqual(2);
    }
  });
  it('keeps social metrics finite and bounded over a long difficult history', () => {
    const a = world(40); for (let i = 6; i < 40; i++) createCharacter(a);
    for (let i = 0; i < 900; i++) {
      if (i % 20 === 0) applyCommand(a, { type: 'trigger-event', eventId: EVENTS[(i / 20) % EVENTS.length].id }, 100_000 * (i + 1));
      step(a);
    }
    for (const value of [a.cohesion,a.resources,a.tension,...a.characters.flatMap(c => [c.mood,c.energy,c.belonging])]) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); }
    for (const r of Object.values(a.relationships)) { expect(r.affinity).toBeGreaterThanOrEqual(-100); expect(r.affinity).toBeLessThanOrEqual(100); expect(r.trust).toBeGreaterThanOrEqual(0); expect(r.trust).toBeLessThanOrEqual(100); }
    expect(a.characters.every(c => c.memories.length <= MEMORY_LIMIT)).toBe(true);
  });
  it('rejects invalid population limits and unknown commands', () => {
    const a = world();
    for (const cap of [0,5,41,NaN,12.5]) expect(() => applyCommand(a, { type: 'settings', mode: 'persistent', populationCap: cap }, 1000)).toThrow();
    expect(() => applyCommand(a, { type: 'trigger-event', eventId: 'missing' }, 1000)).toThrow('Unknown');
  });
  it('grows a ritual in a cohesive house and records its absence in a strained one', () => {
    const a = world(); a.minute = 1078; step(a); expect(a.history.at(-1)?.kind).toBe('ritual');
    const b = world(); b.minute = 1078; b.cohesion = 5; step(b); expect(b.history.at(-1)?.text).toContain('stays quiet');
  });
});
