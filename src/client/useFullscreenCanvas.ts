import { useLayoutEffect, type RefObject } from 'react';
import './fullscreen-canvas.css';

/** Give the complete scene the available fullscreen space, including after panel toggles. */
export function useFullscreenCanvas(pageRef: RefObject<HTMLElement | null>, active: boolean, collapsed: boolean) {
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!active || !page) return;
    const stage = page.querySelector<HTMLElement>('.world-stage')!;
    const canvas = stage.querySelector<SVGSVGElement>('.building')!;
    const toolbar = stage.querySelector<HTMLElement>('.stage-toolbar')!;
    const footer = stage.querySelector<HTMLElement>('.stage-footer')!;
    const layout = stage.parentElement!;
    // Returning from a scrolled journal should reveal the newly fitted scene.
    page.scrollTop = 0;
    function fit() {
      const top = stage.getBoundingClientRect().top - page!.getBoundingClientRect().top + page!.scrollTop;
      const controls = toolbar.offsetHeight + footer.offsetHeight;
      const available = page!.clientHeight - top - controls - 18;
      // Very short screens can scroll instead of reducing the world to a sliver.
      const height = Math.min(Math.max(160, available), (stage.clientWidth * canvas.viewBox.baseVal.height) / canvas.viewBox.baseVal.width);
      const value = `${Math.floor(height)}px`;
      if (layout.style.getPropertyValue('--fullscreen-canvas-height') !== value) {
        layout.style.setProperty('--fullscreen-canvas-height', value);
      }
      const stageHeight = `${Math.floor(height) + controls + 2}px`;
      if (layout.style.getPropertyValue('--fullscreen-stage-height') !== stageHeight) {
        layout.style.setProperty('--fullscreen-stage-height', stageHeight);
      }
    }
    fit();
    const observer = new ResizeObserver(fit);
    [page, stage, toolbar, footer, ...page.querySelectorAll('.fullscreen-site-header, .world-heading, .journal-panel-controls, .world-view-controls, .error-box')].forEach(el => observer.observe(el));
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
      layout.style.removeProperty('--fullscreen-canvas-height');
      layout.style.removeProperty('--fullscreen-stage-height');
    };
  }, [pageRef, active, collapsed]);
}
