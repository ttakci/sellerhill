import { useCallback, useMemo } from 'react';

import { useGetEbayAccountsQuery } from '../api/ebayApi';
import { getStoreLabel, resolveRecordStoreLabel } from '../utils/storeLabel';

/**
 * `ebayAccountId → store label`, or `null` when the seller has one store (or
 * the id is unknown). Every list row, card and detail page that shows "which
 * store is this?" reads it, so the rule "only with more than one store" lives
 * in one place.
 */
export const useStoreLabel = (): ((ebayAccountId?: string | null) => string | null) => {
  const { data } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => data?.items ?? [], [data?.items]);
  return useCallback((ebayAccountId?: string | null) => resolveRecordStoreLabel(accounts, ebayAccountId), [accounts]);
};

/**
 * Options for a store filter `Select`: "all stores" first, then every
 * connected store. `hasMultipleStores` lets a page hide a filter that could
 * only ever offer one store.
 */
export const useStoreFilterOptions = (allStoresLabel: string) => {
  const { data } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => data?.items ?? [], [data?.items]);
  const options = useMemo(
    () => [
      { value: '', label: allStoresLabel },
      ...accounts.map((account) => ({ value: account.id, label: getStoreLabel(account) })),
    ],
    [accounts, allStoresLabel]
  );
  return { options, hasMultipleStores: accounts.length > 1, accounts };
};
