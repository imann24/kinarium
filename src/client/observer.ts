import type { Presence } from '../simulation/types';

export interface ObserverIdentity { id: string; name: string; }
export const OBSERVER_KEY = 'kinarium-player';

export function parseObserver(value: string | null): ObserverIdentity | undefined {
  try {
    const parsed = JSON.parse(value || 'null');
    if (typeof parsed?.id === 'string' && parsed.id.length > 0 && parsed.id.length <= 50 && typeof parsed.name === 'string') {
      return { id: parsed.id, name: parsed.name.trim().slice(0, 24) || 'Wandering observer' };
    }
  } catch { /* A damaged stored identity is treated as a new observer. */ }
}

// Local identity is authoritative even while a reconnect or old HTTP response
// carries the previous name (or temporarily omits this observer altogether).
export function observerPresence(presence: Presence[], identity: ObserverIdentity): Presence[] {
  const rows = new Map(presence.map(p => [p.id, p]));
  rows.set(identity.id, { ...rows.get(identity.id), ...identity,
    color: rows.get(identity.id)?.color || '#718564' });
  return [...rows.values()];
}
