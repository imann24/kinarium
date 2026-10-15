// In SVG, later siblings paint over earlier ones. Use the same ordered, visible
// positions as the sprite pass, including animated cabin/doorway positions.
export const STACK_TOLERANCE = 0.5; // SVG units, less than one pixel at native size.
export type ResidentPoint = { id: string; x: number; y: number };
export function residentStacks(points: ResidentPoint[]) {
  const counts = new Map<string, number>();
  const assigned = new Set<string>();
  for (let i = points.length - 1; i >= 0; i--) {
    const front = points[i];
    if (assigned.has(front.id)) continue;
    assigned.add(front.id);
    let count = 0;
    for (let j = i - 1; j >= 0; j--) {
      const other = points[j];
      if (!assigned.has(other.id) && Math.hypot(front.x - other.x, front.y - other.y) <= STACK_TOLERANCE) {
        assigned.add(other.id); count++;
      }
    }
    if (count) counts.set(front.id, count);
  }
  return counts;
}
