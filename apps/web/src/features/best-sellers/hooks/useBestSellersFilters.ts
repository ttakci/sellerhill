/**
 * useBestSellersFilters
 *
 * Rating / review / price filters over the page being viewed. In memory only
 * and deliberately NOT reset when the list, category or page changes: a seller
 * hunting for "4+ stars under $30" wants that bar to follow them from list to
 * list, the same way the selection does.
 */
import { useCallback, useMemo, useState } from 'react';

import type { BestSellersFilters, BestSellersFilterValues } from '../bestSellers.types';
import {
  EMPTY_BEST_SELLERS_FILTERS,
  hasActiveBestSellersFilters,
  toBestSellersFilterCriteria,
} from '../utils/bestSellersFilters';

export function useBestSellersFilters(): BestSellersFilters {
  const [values, setValues] = useState<BestSellersFilterValues>(EMPTY_BEST_SELLERS_FILTERS);

  const criteria = useMemo(() => toBestSellersFilterCriteria(values), [values]);

  const setField = useCallback(
    (field: keyof BestSellersFilterValues) => (value: string) => setValues((prev) => ({ ...prev, [field]: value })),
    [],
  );

  return {
    values,
    criteria,
    isActive: hasActiveBestSellersFilters(criteria),
    setMinRating: useMemo(() => setField('minRating'), [setField]),
    setMinReviews: useMemo(() => setField('minReviews'), [setField]),
    setPriceMin: useMemo(() => setField('priceMin'), [setField]),
    setPriceMax: useMemo(() => setField('priceMax'), [setField]),
    clear: useCallback(() => setValues(EMPTY_BEST_SELLERS_FILTERS), []),
  };
}
