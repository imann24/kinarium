import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { LIVE_VIEWBOX } from './Building';
import { MAX_ZOOM, MIN_ZOOM, clampZoom, panBy, toScene, zoomAt, zoomCentered, zoomOf, type View } from './scene-zoom';
import './scene-zoom.css';

const BASE: View = { x: LIVE_VIEWBOX[0], y: LIVE_VIEWBOX[1], w: LIVE_VIEWBOX[2], h: LIVE_VIEWBOX[3] };
const STEP = 1.5;
// A finger has to travel this far before a touch on a zoomed scene counts as a pan rather than a tap.
const DRAG_SLOP = 6;

type Gesture =
  | { kind: 'pinch'; distance: number; scale: number; anchor: [number, number] }
  | { kind: 'pan'; x: number; y: number; view: View; moved: boolean };

type SafariGestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };

/**
 * Pinch, trackpad and button zoom for the live house scene. The SVG's viewBox is
 * changed directly so a gesture never re-renders the world, and pinching the
 * scene zooms the house instead of the whole page.
 */
export function useSceneZoom(stageRef: RefObject<HTMLElement | null>, active: boolean, resetKey: string) {
  const view = useRef<View>(BASE);
  const [zoom, setZoom] = useState(1);
  const animation = useRef(0);

  const scene = useCallback(() => stageRef.current?.querySelector<SVGSVGElement>('svg.building') ?? null, [stageRef]);

  const apply = useCallback((next: View) => {
    view.current = next;
    const svg = scene();
    const value = `${next.x} ${next.y} ${next.w} ${next.h}`;
    if (svg && svg.getAttribute('viewBox') !== value) svg.setAttribute('viewBox', value);
    const stage = stageRef.current, zoom = zoomOf(BASE, next);
    stage?.classList.toggle('scene-zoomed', zoom > 1.001);
    stage?.style.setProperty('--scene-zoom', String(zoom));
  }, [scene, stageRef]);

  const settle = useCallback(() => setZoom(zoomOf(BASE, view.current)), []);

  // A remounted scene starts from React's unzoomed viewBox, so carry the current frame over.
  useLayoutEffect(() => { if (active) apply(view.current); });

  useEffect(() => {
    cancelAnimationFrame(animation.current);
    apply(BASE);
    setZoom(1);
  }, [resetKey, apply]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!active || !stage) return;
    let gesture: Gesture | null = null;
    // Set when a gesture ends so the click it leaves behind does not select a resident; the next touch clears it.
    let suppressClick = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let safari: { scale: number; anchor: [number, number] } | null = null;
    const inScene = (target: EventTarget | null) => target instanceof Element && !!target.closest('svg.building') && !target.closest('.speech-box');
    const rect = () => scene()!.getBoundingClientRect();
    const zoomed = () => zoomOf(BASE, view.current) > 1.001;
    const midpoint = (a: Touch, b: Touch) => [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2] as const;
    const distance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const startPan = (x: number, y: number, moved: boolean) => { gesture = { kind: 'pan', x, y, view: view.current, moved }; };
    const startPinch = (a: Touch, b: Touch) => {
      const [x, y] = midpoint(a, b);
      gesture = { kind: 'pinch', distance: Math.max(1, distance(a, b)), scale: zoomOf(BASE, view.current), anchor: toScene(view.current, rect(), x, y) };
    };
    const stop = () => { cancelAnimationFrame(animation.current); };

    function touchStart(e: TouchEvent) {
      if (!inScene(e.target)) return;
      stop();
      if (e.touches.length === 1) suppressClick = false;
      if (e.touches.length >= 2) {
        // Claim two-finger gestures so the browser does not zoom the whole page.
        e.preventDefault();
        startPinch(e.touches[0], e.touches[1]);
      } else if (zoomed()) {
        // Do not prevent default yet: a tap still has to select a resident.
        startPan(e.touches[0].clientX, e.touches[0].clientY, false);
      } else {
        gesture = null;
      }
    }
    function touchMove(e: TouchEvent) {
      if (!gesture) return;
      if (gesture.kind === 'pinch' && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const [x, y] = midpoint(a, b);
        apply(zoomAt(BASE, rect(), gesture.scale * distance(a, b) / gesture.distance, gesture.anchor, x, y));
      } else if (gesture.kind === 'pan' && e.touches.length === 1) {
        const dx = e.touches[0].clientX - gesture.x, dy = e.touches[0].clientY - gesture.y;
        if (!gesture.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
        gesture.moved = true;
        if (e.cancelable) e.preventDefault();
        apply(panBy(BASE, gesture.view, rect(), dx, dy));
      }
    }
    function touchEnd(e: TouchEvent) {
      if (!gesture) return;
      const wasPinch = gesture.kind === 'pinch';
      if (wasPinch || (gesture.kind === 'pan' && gesture.moved)) suppressClick = true;
      if (e.touches.length >= 2) startPinch(e.touches[0], e.touches[1]);
      // Lifting one finger of a pinch carries on as a pan with the other.
      else if (e.touches.length === 1 && zoomed()) startPan(e.touches[0].clientX, e.touches[0].clientY, true);
      else { gesture = null; settle(); }
    }

    function pointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse') suppressClick = false;
      if (e.pointerType !== 'mouse' || e.button !== 0 || !zoomed() || !inScene(e.target)) return;
      stop();
      startPan(e.clientX, e.clientY, false);
      window.addEventListener('pointermove', pointerMove);
      window.addEventListener('pointerup', pointerUp, { once: true });
    }
    function pointerMove(e: PointerEvent) {
      if (gesture?.kind !== 'pan') return;
      const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
      if (!gesture.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
      gesture.moved = true;
      stage!.classList.add('scene-panning');
      apply(panBy(BASE, gesture.view, rect(), dx, dy));
    }
    function pointerUp() {
      window.removeEventListener('pointermove', pointerMove);
      stage!.classList.remove('scene-panning');
      if (gesture?.kind === 'pan' && gesture.moved) suppressClick = true;
      gesture = null;
      settle();
    }

    function click(e: MouseEvent) {
      // The finger or mouse that just panned or pinched should not also select a resident.
      if (suppressClick && inScene(e.target)) {
        suppressClick = false; e.preventDefault(); e.stopPropagation(); }
    }

    function wheel(e: WheelEvent) {
      // Trackpad pinches arrive as ctrl+wheel; plain scrolling still scrolls the page.
      if (!e.ctrlKey || !inScene(e.target)) return;
      e.preventDefault();
      stop();
      const r = rect();
      const delta = Math.max(-50, Math.min(50, e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY));
      apply(zoomAt(BASE, r, zoomOf(BASE, view.current) * Math.exp(-delta * 0.01), toScene(view.current, r, e.clientX, e.clientY), e.clientX, e.clientY));
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 120);
    }

    // Safari reports trackpad pinches as gesture events; on iPhone they also start the page zoom.
    function gestureStart(e: Event) {
      if (!inScene(e.target)) return;
      e.preventDefault();
      if (gesture) return; // Touch events already drive this pinch.
      const g = e as SafariGestureEvent;
      safari = { scale: zoomOf(BASE, view.current), anchor: toScene(view.current, rect(), g.clientX, g.clientY) };
    }
    function gestureChange(e: Event) {
      if (!inScene(e.target)) return;
      e.preventDefault();
      if (!safari || gesture) return;
      const g = e as SafariGestureEvent;
      apply(zoomAt(BASE, rect(), safari.scale * g.scale, safari.anchor, g.clientX, g.clientY));
    }
    function gestureEnd(e: Event) {
      if (!inScene(e.target)) return;
      e.preventDefault();
      if (safari) { safari = null; settle(); }
    }

    const claim = { passive: false } as const;
    stage.addEventListener('touchstart', touchStart, claim);
    stage.addEventListener('touchmove', touchMove, claim);
    stage.addEventListener('touchend', touchEnd);
    stage.addEventListener('touchcancel', touchEnd);
    stage.addEventListener('pointerdown', pointerDown);
    stage.addEventListener('click', click, true);
    stage.addEventListener('wheel', wheel, claim);
    stage.addEventListener('gesturestart', gestureStart, claim);
    stage.addEventListener('gesturechange', gestureChange, claim);
    stage.addEventListener('gestureend', gestureEnd, claim);
    return () => {
      stop();
      clearTimeout(settleTimer);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      stage.classList.remove('scene-panning');
      stage.removeEventListener('touchstart', touchStart);
      stage.removeEventListener('touchmove', touchMove);
      stage.removeEventListener('touchend', touchEnd);
      stage.removeEventListener('touchcancel', touchEnd);
      stage.removeEventListener('pointerdown', pointerDown);
      stage.removeEventListener('click', click, true);
      stage.removeEventListener('wheel', wheel);
      stage.removeEventListener('gesturestart', gestureStart);
      stage.removeEventListener('gesturechange', gestureChange);
      stage.removeEventListener('gestureend', gestureEnd);
    };
  }, [active, stageRef, scene, apply, settle]);

  const animateTo = useCallback((target: View) => {
    cancelAnimationFrame(animation.current);
    const from = view.current;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(target); settle(); return; }
    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / 180), e = 1 - (1 - t) ** 3;
      apply({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (t < 1) animation.current = requestAnimationFrame(frame); else settle();
    };
    animation.current = requestAnimationFrame(frame);
  }, [apply, settle]);

  const zoomBy = useCallback((factor: number) => {
    animateTo(zoomCentered(BASE, view.current, clampZoom(zoomOf(BASE, view.current) * factor)));
  }, [animateTo]);

  return {
    zoom,
    canZoomIn: zoom < MAX_ZOOM - 0.001,
    canZoomOut: zoom > MIN_ZOOM + 0.001,
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    reset: () => animateTo(BASE),
  };
}
