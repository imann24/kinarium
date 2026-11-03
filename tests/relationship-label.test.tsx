import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createWorld, relationship } from '../src/simulation/engine';
import type { Relationship } from '../src/simulation/types';
import { bondKind, relationshipLabel } from '../src/client/relationship-label';
import { communityInsights } from '../src/client/community-insights';
import { relationshipNarrative } from '../src/client/relationship-narrative';
import Bonds from '../src/client/Bonds';
import CommunityInsights, { insightLocation } from '../src/client/CommunityInsights';

const pair = (patch: Partial<Relationship> = {}): Relationship => ({
  a: 'c1', b: 'c2', encounters: 1, affinity: 0, trust: 20, lastMinute: 500, ...patch,
});
const conflict = { id: 7, minute: 500, topic: 'Shared space' };
const history = { connections: [], disagreements: [], perspectives: {} };

describe('relationship labels over time', () => {
  it.each([
    [pair({ encounters: 0, affinity: 90, trust: 90 }), 'Yet to meet'],
    [pair(), 'Getting acquainted'],
    [pair({ encounters: 9 }), 'Getting acquainted'],
    [pair({ encounters: 10 }), 'Familiar but distant'],
    [pair({ encounters: 467, trust: 0 }), 'Familiar but distant'],
    [pair({ encounters: 467, affinity: 35, trust: 55 }), 'Familiar but distant'],
    [pair({ encounters: 467, affinity: 35.1, trust: 55 }), 'Fond but cautious'],
    [pair({ encounters: 467, affinity: 35.1, trust: 55.1 }), 'Close'],
    [pair({ encounters: 467, affinity: 0, trust: 56 }), 'Trusted, not close'],
    [pair({ encounters: 467, affinity: -20, trust: 0 }), 'Familiar but distant'],
    [pair({ affinity: -20.1, trust: 90 }), 'Strained'],
    [pair({ affinity: 90, trust: 90, unresolvedConflict: conflict }), 'Strained'],
    [pair({ unresolvedConflict: conflict, repairCommitment: { conflictId: 7, initiatorId: 'c1' } }), 'Repair promised'],
  ])('reads current facts without requiring history: %j → %s', (r, label) => {
    const saved = structuredClone(r);
    expect(relationshipLabel(r)).toBe(label);
    expect(r).toEqual(saved);
  });

  it('uses a recorded friendship as familiarity without claiming past friendship from scores alone', () => {
    const r = pair({ story: { ...history, friendsMinute: 0 } });
    expect(relationshipLabel(r)).toBe('Familiar but distant');
    delete r.story;
    expect(relationshipLabel(r)).toBe('Getting acquainted');
    r.encounters = 467;
    const w = createWorld({ slug: 'labels', name: 'Labels', populationCap: 2 }, 0, 42);
    const n = relationshipNarrative(r, w.characters[0], w.characters[1]);
    expect(n.story.join(' ')).toContain('familiar but distant');
    expect(n.story.join(' ')).not.toMatch(/friends|reconnect|getting to know/);
    expect(n.views[0].feeling).toContain('not close at present');
  });

  it('does not turn old, declined, completed or superseded repair history into active recovery', () => {
    const r = pair({ encounters: 400, unresolvedConflict: conflict, lastRepairMinute: 500,
      story: { ...history, perspectives: { c1: { reachedOut: 20, repairsOffered: 3, promisesKept: 1, spaceRequested: 2 } } } });
    expect(bondKind(r)).toBe('strained');
    r.repairCommitment = { conflictId: 6, initiatorId: 'c1' };
    expect(bondKind(r)).toBe('strained');
    r.repairCommitment.conflictId = 7;
    expect(bondKind(r)).toBe('repairing');
    r.repairedConflictId = 7;
    expect(bondKind(r)).toBe('strained');
    delete r.unresolvedConflict;
    expect(bondKind(r)).toBe('familiar');
    r.affinity = 60; r.trust = 80;
    expect(bondKind(r)).toBe('close');
  });

  it('keeps Bonds, Insights counts/filters and story readings consistent without changing old saves', () => {
    const w = createWorld({ slug: 'labels', name: 'Labels', populationCap: 2 }, 0, 42);
    const [a, b] = w.characters;
    const r = relationship(w, a.id, b.id);
    for (const patch of [
      { encounters: 467, affinity: 0, trust: 0 },
      { affinity: 50, trust: 20 },
      { affinity: 0, trust: 70 },
      { affinity: 50, trust: 70 },
      { unresolvedConflict: conflict },
      { repairCommitment: { conflictId: 7, initiatorId: a.id } },
    ]) {
      Object.assign(r, patch);
      const before = structuredClone(w);
      const label = relationshipLabel(r), kind = bondKind(r);
      expect(renderToStaticMarkup(<Bonds world={w} onSelect={() => {}}/>)).toContain(`${label} · 467 encounters`);
      expect(renderToStaticMarkup(<CommunityInsights world={w} onSelectResident={() => {}}/>)).toContain(`${label} · 467 encounters`);
      expect(communityInsights(w).distribution[kind]).toBe(1);
      expect(Object.values(communityInsights(w).distribution).reduce((a, b) => a + b, 0)).toBe(1);
      expect(insightLocation(`?connections=${kind}`).filter).toBe(kind);
      expect(relationshipNarrative(r, a, b).story.join(' ')).not.toContain('still getting to know');
      expect(w).toEqual(before);
    }
  });
});
