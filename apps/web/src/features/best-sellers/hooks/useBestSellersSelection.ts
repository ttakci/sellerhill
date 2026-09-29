/**
 * The seller's ticked ASINs on the Best Sellers page.
 *
 * Lives in component state only: it is a scratch list on the way to the Add
 * Listings drawer, not something worth persisting, and it must survive every
 * list / category / page change so a seller can gather products from several
 * lists before listing them in one batch.
 */

import { useCallback, useMemo, useState } from 'react';

import type { BestSellersSelection } from '../bestSellers.types';

export function useBestSellersSelection(): BestSellersSelection {
  const [selectedAsins, setSelectedAsins] = useState<ReadonlySet<string>>(() => new Set<string>());

  const isSelected = useCallback((asin: string) => selectedAsins.has(asin), [selectedAsins]);

  const toggle = useCallback((asin: string) => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) {
        next.delete(asin);
      } else {
        next.add(asin);
      }
      return next;
    });
  }, []);

  const selectMany = useCallback((asins: readonly string[]) => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      asins.forEach((asin) => next.add(asin));
      return next;
    });
  }, []);

  const deselectMany = useCallback((asins: readonly string[]) => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      asins.forEach((asin) => next.delete(asin));
      return next;
    });
  }, []);

  const setPageSelection = useCallback((pageAsins: readonly string[], selected: readonly string[]) => {
    setSelectedAsins((prev) => {
      const next = new Set(prev);
      pageAsins.forEach((asin) => next.delete(asin));
      selected.forEach((asin) => next.add(asin));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedAsins(new Set<string>());
  }, []);

  return useMemo(
    () => ({
      selectedAsins,
      count: selectedAsins.size,
      isSelected,
      toggle,
      selectMany,
      deselectMany,
      setPageSelection,
      clear,
    }),
    [selectedAsins, isSelected, toggle, selectMany, deselectMany, setPageSelection, clear],
  );
}
