import { useCallback, useRef, type TouchEvent } from 'react';

/** Horizontal distance (px) a finger must travel before a swipe counts. */
const SWIPE_THRESHOLD_PX = 40;

export interface SwipeNavigationHandlers {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLElement>) => void;
}

/**
 * Touch handlers that turn a horizontal swipe into prev/next (the carousels
 * on the dashboard and the listings overview — the arrows are hover-only and
 * the dots are tiny, so on a phone the only natural gesture was doing
 * nothing). A mostly-vertical drag is left to the page scroll: the swipe is
 * counted only when the horizontal travel beats both the threshold and the
 * vertical travel. Spread the result on the viewport element and give it
 * `touch-action: pan-y` so the browser keeps vertical panning native.
 */
export function useSwipeNavigation(onNext: () => void, onPrev: () => void): SwipeNavigationHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const origin = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (!origin || !touch) {
        return;
      }
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      if (dx < 0) {
        onNext();
      } else {
        onPrev();
      }
    },
    [onNext, onPrev],
  );

  return { onTouchStart, onTouchEnd };
}
