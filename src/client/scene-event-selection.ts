import type { EventDefinition } from '../simulation/catalog';

/** Draw fresh shortcuts before repeating any of the current choices. */
export function shuffleSceneEvents(events: readonly EventDefinition[], previous: readonly EventDefinition[] = []): EventDefinition[] {
  const shuffled = [...events];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const shown = new Set(previous.map(event => event.id));
  const next = [...shuffled.filter(event => !shown.has(event.id)), ...shuffled.filter(event => shown.has(event.id))].slice(0, 3);
  // Small server catalogs can only change order. Still make every shuffle visible.
  if (next.length > 1 && next.every((event, index) => event.id === previous[index]?.id)) next.push(next.shift()!);
  return next;
}
