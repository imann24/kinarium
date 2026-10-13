import { useEffect, useRef, useState } from 'react';

export function useWorldFullscreen() {
  const ref = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [changing, setChanging] = useState(false);
  const isFullscreen = nativeFullscreen || expanded;
  const wasFullscreen = useRef(false);

  useEffect(() => {
    const sync = () => setNativeFullscreen(document.fullscreenElement === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  useEffect(() => {
    if (wasFullscreen.current && !isFullscreen) buttonRef.current?.focus({ preventScroll: true });
    wasFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      // Let an open dialog handle Escape before leaving the expanded world.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
        if (document.fullscreenElement === ref.current) {
          void document.exitFullscreen().catch(() => { /* Keep the exit button available. */ });
        } else {
          setExpanded(false);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  async function toggle() {
    const element = ref.current;
    if (!element || changing) return;
    if (expanded) { setExpanded(false); return; }
    setChanging(true);
    try {
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else if (document.fullscreenEnabled && element.requestFullscreen) {
        try { await element.requestFullscreen(); }
        catch { setExpanded(true); }
      } else {
        setExpanded(true);
      }
    } catch {
      // If the browser refuses to exit, keep the exit control available; Escape still works.
    } finally {
      setChanging(false);
    }
  }

  return { ref, buttonRef, isFullscreen, changing, toggle };
}
