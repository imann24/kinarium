import { useLayoutEffect, type RefObject } from 'react';

/** Fit the complete house and its controls into the first screen of a world. */
export function useWorldViewport(stageRef: RefObject<HTMLElement | null>, ready: boolean) {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!ready || !stage) return;

    const canvas = stage.querySelector<SVGSVGElement>('.building');
    const footer = stage.querySelector<HTMLElement>('.stage-footer');
    const stats = stage.querySelector<HTMLElement>('.community-stats');
    if (!canvas || !footer || !stats) return;

    function fit() {
      // Use the document position so scrolling never changes the house's scale.
      const top = canvas!.getBoundingClientRect().top + window.scrollY;
      const controls = footer!.getBoundingClientRect().height + stats!.getBoundingClientRect().height;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      // Leave 16px below the stage, plus its 1px bottom border.
      // Short screens can scroll instead of shrinking the scene to a sliver.
      const height = Math.max(160, Math.floor(viewportHeight - top - controls - 17));
      const value = `${height}px`;
      if (stage!.style.getPropertyValue('--world-canvas-height') !== value) {
        stage!.style.setProperty('--world-canvas-height', value);
      }
    }

    fit();
    // Refit after heading/control wrapping or font loading changes the layout.
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    observer.observe(footer);
    observer.observe(stats);
    const page = stage.closest('.world-page');
    const heading = page?.querySelector('.world-heading');
    const header = document.querySelector('.site-header');
    if (page) observer.observe(page);
    if (heading) observer.observe(heading);
    if (header) observer.observe(header);
    page?.querySelectorAll('.world-view-nav, .journal-panel-controls, .world-view-controls, .error-box').forEach(el => observer.observe(el));
    window.addEventListener('resize', fit);
    window.visualViewport?.addEventListener('resize', fit);
    return () => {
      observer.disconnect();
      stage.style.removeProperty('--world-canvas-height');
      window.removeEventListener('resize', fit);
      window.visualViewport?.removeEventListener('resize', fit);
    };
  }, [stageRef, ready]);
}
