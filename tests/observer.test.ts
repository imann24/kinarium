import { describe, expect, it } from 'vitest';
import { observerPresence, parseObserver } from '../src/client/observer';

describe('observer identity', () => {
  const self = { id: 'self-id', name: 'New name' };
  it('overlays stale self names by ID without renaming a same-name visitor', () => {
    const presence = [{ id: self.id, name: 'Old name', color: 'green' }, { id: 'other-id', name: 'Old name', color: 'blue' }];
    expect(observerPresence(presence, self)).toEqual([{ ...presence[0], name: 'New name' }, presence[1]]);
    expect(presence[0].name).toBe('Old name');
  });
  it('retains the local observer while reconnect snapshots omit it', () => {
    expect(observerPresence([], self)).toEqual([{ ...self, color: '#718564' }]);
  });
  it('does not confuse duplicate names or duplicate socket entries with identity', () => {
    const rows = observerPresence([{ id: 'other', name: self.name, color: 'blue' }, { ...self, color: 'red' }, { ...self, name: 'Stale', color: 'red' }], self);
    expect(rows).toHaveLength(2);
    expect(rows.filter(p => p.id === self.id)).toEqual([{ ...self, color: 'red' }]);
  });
  it('validates persisted identities and normalizes names', () => {
    for (const value of [null, '{', '{}', 'null', '{"id":12,"name":"X"}', '{"id":"","name":"X"}']) expect(parseObserver(value)).toBeUndefined();
    expect(parseObserver(JSON.stringify({ id: 'stable', name: '  ' }))).toEqual({ id: 'stable', name: 'Wandering observer' });
    expect(parseObserver(JSON.stringify(self))).toEqual(self);
  });
});
