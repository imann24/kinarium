import { describe, expect, it } from 'vitest';
import { activeCharacters, chooseFloor, createWorld, step } from '../src/simulation/engine';
import { TEMPLATES } from '../src/simulation/catalog';

describe('house layouts', () => {
  it('keeps the original uniform floor choice when floors have no draw', () => {
    for (let i = 0; i < 300; i++) {
      const draw = i / 300;
      expect(chooseFloor(TEMPLATES['common-house'], draw)).toBe(Math.floor(draw * 3));
    }
  });
  it('sends most trips through the courtyard and keeps residents inside narrow floors', () => {
    const s = createWorld({ slug: 'courtyard', name: 'Courtyard', templateId: 'courtyard-house' }, 1_000, 7);
    const visits = [0, 0, 0];
    for (let i = 0; i < 1500; i++) {
      step(s);
      for (const c of activeCharacters(s)) {
        if (c.inElevator || c.destination !== c.floor) continue;
        const minute = s.minute % 1440;
        if (minute >= 420 && minute < 1200) visits[c.floor]++;
        const span = TEMPLATES['courtyard-house'].floors[c.floor].span;
        if (span && c.activity !== 'stepping out of the elevator') {
          expect(c.x).toBeGreaterThanOrEqual(span[0] - 2);
          expect(c.x).toBeLessThanOrEqual(span[1] + 2);
        }
      }
    }
    // Uniform choice would give each floor about a third of daytime visits.
    expect(visits[0] / (visits[0] + visits[1] + visits[2])).toBeGreaterThan(.5);
  });
  it('gathers the lantern tower in the lantern room at night', () => {
    const s = createWorld({ slug: 'tower', name: 'Tower', templateId: 'lantern-tower' }, 1_000, 7);
    let top = 0, total = 0;
    for (let i = 0; i < 4000; i++) {
      step(s);
      const minute = s.minute % 1440;
      if (minute >= 120 && minute < 330) for (const c of activeCharacters(s)) { total++; if (c.floor === 2) top++; }
    }
    expect(top / total).toBeGreaterThan(.6);
  });
});
