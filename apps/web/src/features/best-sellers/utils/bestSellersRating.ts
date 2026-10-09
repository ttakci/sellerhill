/**
 * The five stars drawn beside a rating, the way Amazon draws them: a star is
 * full, half or empty in steps of half a star. 4.6 → ★★★★⯪, 4.8 → ★★★★★.
 */
import type { BestSellersStarFill } from '../bestSellers.types';

export const BEST_SELLERS_STAR_COUNT = 5;

export function toStarFills(average: number): BestSellersStarFill[] {
  const clamped = Math.min(Math.max(average, 0), BEST_SELLERS_STAR_COUNT);
  const halves = Math.round(clamped * 2);
  return Array.from({ length: BEST_SELLERS_STAR_COUNT }, (_, index) => {
    const remaining = halves - index * 2;
    if (remaining >= 2) {
      return 'full';
    }
    return remaining === 1 ? 'half' : 'empty';
  });
}
