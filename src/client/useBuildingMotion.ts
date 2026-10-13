import { useLayoutEffect, useRef, useState } from 'react';
import type { WorldState } from '../simulation/types';
import { cabinFloor, motionEndsAt, planBuildingMotion, residentPosition } from './building-motion';

export function useBuildingMotion(world: WorldState, miniature: boolean) {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [now, setNow] = useState(() => performance.now());
  const motion = useRef(planBuildingMotion(undefined, world, now));
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    const start = performance.now();
    motion.current = planBuildingMotion(motion.current, world, start, reduced || miniature);
    setNow(start);
    let frame = 0;
    function tick(time: number) {
      setNow(time);
      if (time < motionEndsAt(motion.current)) frame = requestAnimationFrame(tick);
    }
    if (start < motionEndsAt(motion.current)) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [world, reduced, miniature]);
  return {
    elevatorFloor: cabinFloor(motion.current, now),
    position: (id: string) => motion.current.residents[id] ? residentPosition(motion.current, id, now) : undefined,
  };
}
