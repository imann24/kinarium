import { describe, expect, it } from 'vitest';
import { EVENTS } from '../src/simulation/catalog';
import { serverEvents } from '../src/client/event-effects';

describe('serverEvents', () => {
  it('hides events the world’s server does not know yet', () => {
    const older = EVENTS.filter(e => e.id !== 'shouting-match').map(e => e.id);
    const shown = serverEvents(EVENTS, older);
    expect(shown.map(e => e.id)).toEqual(older);
    expect(shown.some(e => e.id === 'shouting-match')).toBe(false);
  });
  it('ignores server ids the page has no card for', () => {
    expect(serverEvents(EVENTS, [...EVENTS.map(e => e.id), 'from-the-future'])).toEqual(EVENTS);
  });
  it('offers every event when the server does not report its list', () => {
    expect(serverEvents(EVENTS, undefined)).toBe(EVENTS);
  });
});
