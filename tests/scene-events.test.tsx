import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SceneEvents from '../src/client/SceneEvents';
import { eventBudget } from '../src/simulation/event-budget';

const render = (overrides: Partial<Parameters<typeof SceneEvents>[0]> = {}) => renderToStaticMarkup(<SceneEvents budget={eventBudget([], 0)} now={0} readyAt={0} disabled={false} onPick={() => {}} {...overrides}/>);
const disabledButtons = (html: string) => html.match(/<button[^>]*disabled=""/g)?.length ?? 0;
describe('stage event shortcuts', () => {
  it('uses only server-supported events and retains the complete picker link', () => {
    const html = render({ eventIds: ['care-package'] });
    expect(html).toContain('An unexpected gift');
    expect(html).not.toContain('A shared meal');
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('href="#house-events"');
  });
  it('blocks shortcuts while disconnected or another command is pending', () => {
    expect(disabledButtons(render({ disabled: true }))).toBe(3);
  });
  it('shares the full picker’s house cooldown and personal allowance', () => {
    const settling = render({ readyAt: 30_000 });
    expect(disabledButtons(settling)).toBe(3);
    expect(settling).toContain('Settling');
    const exhausted = render({ budget: eventBudget([-100_000, -50_000, -10_000], 0) });
    expect(disabledButtons(exhausted)).toBe(3);
    expect(exhausted).toContain('Refills in');
    expect(disabledButtons(render({ now: 300_000, readyAt: 30_000, budget: eventBudget([-100_000, -50_000, -10_000], 0) }))).toBe(0);
  });
});
