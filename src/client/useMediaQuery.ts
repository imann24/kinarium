import { useLayoutEffect, useState } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useLayoutEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [query]);
  return matches;
}

/** Portrait phones, plus phones held sideways (wider than 760px but short, with touch only). */
export const PHONE_QUERY = '(max-width: 760px), (orientation: landscape) and (max-height: 500px) and (hover: none) and (pointer: coarse)';
