/** A viewBox frame in scene units. */
export type View = { x: number; y: number; w: number; h: number };
type Rect = { left: number; top: number; width: number; height: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function clampZoom(scale: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

export function zoomOf(base: View, view: View) {
  return base.w / view.w;
}

/** Keep a zoomed frame inside the scene so panning never reveals empty space. */
export function clampView(base: View, view: View): View {
  const w = Math.min(base.w, view.w), h = Math.min(base.h, view.h);
  return {
    x: Math.min(base.x + base.w - w, Math.max(base.x, view.x)),
    y: Math.min(base.y + base.h - h, Math.max(base.y, view.y)),
    w, h,
  };
}

/** Screen pixels per scene unit and the frame's on-screen origin, for the SVG's default `xMidYMid meet`. */
function fit(view: View, rect: Rect) {
  const k = Math.min(rect.width / view.w, rect.height / view.h);
  return { k, left: rect.left + (rect.width - view.w * k) / 2, top: rect.top + (rect.height - view.h * k) / 2 };
}

export function toScene(view: View, rect: Rect, clientX: number, clientY: number): [number, number] {
  const f = fit(view, rect);
  return [view.x + (clientX - f.left) / f.k, view.y + (clientY - f.top) / f.k];
}

/** The frame at `scale` that keeps scene point `anchor` under the screen point `clientX, clientY`. */
export function zoomAt(base: View, rect: Rect, scale: number, anchor: [number, number], clientX: number, clientY: number): View {
  const s = clampZoom(scale);
  const w = base.w / s, h = base.h / s;
  const f = fit({ x: 0, y: 0, w, h }, rect);
  return clampView(base, { x: anchor[0] - (clientX - f.left) / f.k, y: anchor[1] - (clientY - f.top) / f.k, w, h });
}

/** Move a frame by a screen-pixel drag. */
export function panBy(base: View, view: View, rect: Rect, dx: number, dy: number): View {
  const { k } = fit(view, rect);
  return clampView(base, { ...view, x: view.x - dx / k, y: view.y - dy / k });
}

/** Zoom around the middle of the current frame, as the zoom buttons do. */
export function zoomCentered(base: View, view: View, scale: number): View {
  const s = clampZoom(scale);
  const w = base.w / s, h = base.h / s;
  return clampView(base, { x: view.x + (view.w - w) / 2, y: view.y + (view.h - h) / 2, w, h });
}
