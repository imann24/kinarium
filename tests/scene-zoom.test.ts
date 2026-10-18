import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, clampView, panBy, toScene, zoomAt, zoomCentered, zoomOf } from '../src/client/scene-zoom';

const base = { x: 32, y: 24, w: 856, h: 594 };
// A phone-width canvas taller than the scene's aspect, so the scene is letterboxed vertically.
const rect = { left: 10, top: 100, width: 390, height: 300 };

describe('scene zoom', () => {
  it('keeps the pinched point under the fingers', () => {
    const anchor = toScene(base, rect, 200, 250);
    const view = zoomAt(base, rect, 2, anchor, 200, 250);
    expect(zoomOf(base, view)).toBeCloseTo(2);
    const [x, y] = toScene(view, rect, 200, 250);
    expect(x).toBeCloseTo(anchor[0]);
    expect(y).toBeCloseTo(anchor[1]);
  });

  it('follows the fingers when they move while pinching', () => {
    const anchor = toScene(base, rect, 150, 250);
    const view = zoomAt(base, rect, 2.5, anchor, 220, 230);
    const [x, y] = toScene(view, rect, 220, 230);
    expect(x).toBeCloseTo(anchor[0]);
    expect(y).toBeCloseTo(anchor[1]);
  });

  it('never zooms out past the whole house or in past the limit', () => {
    expect(zoomAt(base, rect, 0.3, [400, 300], 100, 200)).toEqual(base);
    expect(zoomOf(base, zoomAt(base, rect, 40, [400, 300], 100, 200))).toBeCloseTo(MAX_ZOOM);
  });

  it('keeps panning inside the scene', () => {
    const zoomed = zoomCentered(base, base, 2);
    expect(panBy(base, zoomed, rect, 10_000, 10_000)).toMatchObject({ x: base.x, y: base.y });
    const far = panBy(base, zoomed, rect, -10_000, -10_000);
    expect(far.x + far.w).toBeCloseTo(base.x + base.w);
    expect(far.y + far.h).toBeCloseTo(base.y + base.h);
  });

  it('pans by the finger distance in scene units', () => {
    const zoomed = zoomCentered(base, base, 2);
    const moved = panBy(base, zoomed, rect, -39, 0);
    // 390px shows 428 scene units at 2x, so 39px is 42.8 units.
    expect(moved.x - zoomed.x).toBeCloseTo(42.8);
  });

  it('clamps an oversized frame back to the scene', () => {
    expect(clampView(base, { x: 0, y: 0, w: 2000, h: 2000 })).toEqual(base);
  });
});
