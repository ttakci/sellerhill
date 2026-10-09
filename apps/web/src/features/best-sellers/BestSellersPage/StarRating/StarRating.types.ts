import type { BestSellersStarFill } from '../../bestSellers.types';

export interface StarRatingProps {
  /** Five entries, from `toStarFills`. */
  stars: readonly BestSellersStarFill[];
  /** Accessible reading of the row, e.g. "4.6" — the stars themselves are decorative. */
  label: string;
}
