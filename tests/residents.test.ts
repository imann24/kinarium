import { describe, expect, it } from 'vitest';
import { TEMPLATES, TRAITS } from '../src/simulation/catalog';
import { advance, applyCommand, createCharacter, createWorld, step } from '../src/simulation/engine';
import type { WorldState } from '../src/simulation/types';
// Produced by createWorld + set-away from 33cce93, before memories/roster changes.
import legacy from './fixtures/legacy-residents.json';

const identity = (s: WorldState) => s.characters.map(({ id, name, trait, backstory, color }) => ({ id, name, trait, backstory, color }));

describe('starter residents', () => {
  it('has distinct, complete profiles using only supported traits', () => {
    const profiles = Object.values(TEMPLATES).flatMap(t => [...t.starterResidents]);
    expect(new Set(profiles.map(p => p.name)).size).toBe(profiles.length);
    expect(new Set(profiles.map(p => p.backstory)).size).toBe(profiles.length);
    for (const template of Object.values(TEMPLATES)) {
      expect(template.starterResidents.length).toBeGreaterThanOrEqual(12);
      expect(new Set(template.starterResidents.map(p => p.trait))).toEqual(new Set(TRAITS));
      for (const p of template.starterResidents) {
        expect(p.name.trim()).toBe(p.name); expect(p.name.length).toBeGreaterThan(0); expect(p.name.length).toBeLessThanOrEqual(30);
        expect(TRAITS).toContain(p.trait);
        expect(p.backstory).toContain(p.name); expect(p.backstory.length).toBeGreaterThan(60); expect(p.backstory.length).toBeLessThanOrEqual(500);
      }
    }
  });

  it.each(Object.values(TEMPLATES))('$id samples coherent profiles reproducibly without duplicates and honors caps', template => {
    const rosterBefore = structuredClone(template.starterResidents);
    const selections = new Set<string>(); const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      for (const cap of [1, 3, 6, 12, 40]) {
        const input = { slug: 'seeded', name: 'Seeded', templateId: template.id, populationCap: cap };
        const a = createWorld(input, 1000, seed);
        expect(a).toEqual(createWorld(input, 1000, seed));
        expect(a.characters).toHaveLength(Math.min(6, cap));
        expect(new Set(a.characters.map(c => c.name)).size).toBe(a.characters.length);
        expect(a.characters.map(c => c.id)).toEqual(a.characters.map((_, i) => `c${i + 1}`));
        expect(a.nextCharacter).toBe(a.characters.length + 1);
        for (const c of a.characters) {
          expect(template.starterResidents).toContainEqual({ name: c.name, trait: c.trait, backstory: c.backstory });
          expect(c.memories).toHaveLength(1); expect(c.memories[0].kind).toBe('arrival');
          expect(c.memories[0].text).not.toBe(c.backstory);
          seen.add(c.name);
        }
        if (cap === 12) selections.add(a.characters.map(c => c.name).sort().join(','));
      }
    }
    expect(selections.size).toBeGreaterThan(50);
    expect(seen).toEqual(new Set(template.starterResidents.map(p => p.name)));
    expect(template.starterResidents).toEqual(rosterBefore);
  });

  it.each(Object.values(TEMPLATES))('$id keeps saved identities through reload, events, away/return and later introductions', template => {
    const original = createWorld({ slug: 'saved', name: 'Saved', templateId: template.id, populationCap: 40 }, 1000, 0xffffffff);
    const before = identity(original);
    const restored: WorldState = JSON.parse(JSON.stringify(original));
    for (const s of [original, restored]) {
      applyCommand(s, { type: 'set-away', characterId: 'c1', away: true }, 1000);
      // Exhaust the automatic names and exercise collisions with randomized starters.
      for (let i = 0; i < 30; i++) createCharacter(s);
      applyCommand(s, { type: 'trigger-event', eventId: 'shared-meal' }, 2000);
      applyCommand(s, { type: 'set-away', characterId: 'c1', away: false }, 3000);
      advance(s, 41000);
    }
    expect(restored).toEqual(original);
    expect(identity(restored).slice(0, 6)).toEqual(before);
    expect(new Set(restored.characters.map(c => c.name)).size).toBe(restored.characters.length);
    expect(new Set(restored.characters.map(c => c.id)).size).toBe(restored.characters.length);
    const ids = new Set(restored.characters.map(c => c.id));
    for (const r of Object.values(restored.relationships)) { expect(ids.has(r.a)).toBe(true); expect(ids.has(r.b)).toBe(true); }
  });

  it('skips automatic name collisions including away residents and numbered custom names', () => {
    const saved = JSON.parse(JSON.stringify(legacy)) as WorldState;
    saved.characters[0].name = 'Ada'; // Away, but still part of this house.
    saved.characters[1].name = 'Ada 2';
    const added = createCharacter(saved);
    expect(added.name).toBe('Ada 3');
    expect(added.id).toBe('c7');
    expect(saved.characters[0].name).toBe('Ada');
    expect(saved.characters[1].name).toBe('Ada 2');
  });

  it('resumes a real legacy snapshot without replacing identities, away residents or old memories', () => {
    const saved = JSON.parse(JSON.stringify(legacy)) as WorldState;
    const before = identity(saved); const memories = structuredClone(saved.characters[0].memories);
    expect(saved.characters.map(c => c.name)).toEqual(['Milo', 'Juniper', 'Cleo', 'Otis', 'Fern', 'Remy']);
    for (let i = 0; i < 20; i++) step(saved);
    expect(identity(saved)).toEqual(before);
    expect(saved.characters[0].away).toBe(true);
    expect(saved.characters[0].memories).toEqual(memories);
    expect(createCharacter(saved).id).toBe('c7');
    expect(saved.version).toBe(1);
  });
});
