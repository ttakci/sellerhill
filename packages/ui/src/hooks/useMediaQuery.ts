import { useEffect, useState } from 'react';

/**
 * Hook that tracks a CSS media query match state.
 * Uses `window.matchMedia` with event listener for reactive updates.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') {return false;}
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Convenience hook that returns true when the viewport is below the given breakpoint.
 * @param breakpoint CSS max-width value (default: '48rem' / 768px)
 */
export function useIsMobile(breakpoint = '48rem'): boolean {
  return useMediaQuery(`(max-width: ${breakpoint})`);
}
