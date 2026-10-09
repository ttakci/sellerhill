/**
 * useBestSellersFilters
 *
 * Search / rating / range filters over the page being viewed. In memory only
 * and deliberately NOT reset when the list, category or page changes: a seller
 * hunting for "4+ stars under $30" wants that bar to follow them from list to
 * list, the same way the selection does.
 */
import { useCallback, useMemo, useState } from 'react';

import type {
  BestSellersFilters,
  BestSellersFilterValues,
  BestSellersRangeBound,
  BestSellersRangeKey,
} from '../bestSellers.types';
import {
  EMPTY_BEST_SELLERS_FILTERS,
  hasActiveBestSellersFilters,
  toBestSellersFilterCriteria,
} from '../utils/bestSellersFilters';

export function useBestSellersFilters(): BestSellersFilters {
  const [values, setValues] = useState<BestSellersFilterValues>(EMPTY_BEST_SELLERS_FILTERS);

  const criteria = useMemo(() => toBestSellersFilterCriteria(values), [values]);

  const setSearch = useCallback((value: string) => setValues((prev) => ({ ...prev, search: value })), []);
  const setMinRating = useCallback((value: string) => setValues((prev) => ({ ...prev, minRating: value })), []);
  const setRange = useCallback(
    (key: BestSellersRangeKey, bound: BestSellersRangeBound, value: string) =>
      setValues((prev) => ({
        ...prev,
        ranges: { ...prev.ranges, [key]: { ...prev.ranges[key], [bound]: value } },
      })),
    [],
  );
  const clearRange = useCallback(
    (key: BestSellersRangeKey) =>
      setValues((prev) => ({ ...prev, ranges: { ...prev.ranges, [key]: { min: '', max: '' } } })),
    [],
  );
  const clear = useCallback(() => setValues(EMPTY_BEST_SELLERS_FILTERS), []);

  return useMemo(
    () => ({
      values,
      criteria,
      isActive: hasActiveBestSellersFilters(criteria),
      setSearch,
      setMinRating,
      setRange,
      clearRange,
      clear,
    }),
    [values, criteria, setSearch, setMinRating, setRange, clearRange, clear],
  );
}
