import type { Character, WorldState } from './types';
import { CONVERSATION_RADIUS } from './conversations';
import { TEMPLATES } from './catalog';

// 1.5 map units = 8.775 SVG units: a small step, not body collision physics.
export const STANDING_GAP = 1.5;
export const MIN_STANDING_GAP = 0.25; // 1.4625 SVG units, beyond the stack badge tolerance.
const EPSILON = 1e-7;

/** Resolve shared standing points without consuming randomness or blocking travel.
 * Keep already distinct positions; reserve them before moving anyone. Cabin
 * occupants deliberately share a point. Furniture is background scenery; the
 * navigable floor is the existing horizontal lane, with its existing bounds.
 */
export function separateStandingResidents(world: WorldState) {
  const people = world.characters.filter(c => !c.away && !c.inElevator);
  const groups = world.history.filter(e => e.conversation?.status === 'active' && e.conversation.proximity)
    .map(e => new Set(e.characters));
  const placed: Character[] = [];
  // Stable persisted array order gives the same resident priority on every tick.
  for (const c of people) {
    const overlaps = (x: number, others: Character[], gap = MIN_STANDING_GAP) => others.some(p => p.id !== c.id && p.floor === c.floor && Math.abs(p.x - x) < gap - EPSILON);
    if (!overlaps(c.x, placed)) { placed.push(c); continue; }
    const peers = people.filter(p => p.id !== c.id && groups.some(g => g.has(c.id) && g.has(p.id)));
    // Stay within the floor's walkable span (narrow floors in some layouts).
    const [spanLow, spanHigh] = TEMPLATES[world.templateId]?.floors[c.floor]?.span ?? [8, 84];
    const low = Math.max(spanLow, ...peers.map(p => p.x - CONVERSATION_RADIUS));
    const high = Math.min(c.destination === c.floor ? spanHigh : 94, ...peers.map(p => p.x + CONVERSATION_RADIUS));
    // Nearest free boundary of an occupied interval is sufficient in one dimension.
    for (const gap of [STANDING_GAP, MIN_STANDING_GAP]) {
      const candidates = [low, high, ...people.filter(p => p.floor === c.floor && p.id !== c.id)
        .flatMap(p => [p.x - gap, p.x + gap])]
        .filter(x => x >= low && x <= high)
        .sort((a, b) => Math.abs(a - c.x) - Math.abs(b - c.x) || a - b);
      const free = candidates.find(x => !overlaps(x, people, gap));
      if (free !== undefined) { c.x = free; break; }
    }
    // If spatial/conversation constraints leave no room, retain the position.
    // The renderer reports such unavoidable stacks rather than breaking a group.
    placed.push(c);
  }
}
