/**
 * URL-backed Cancellations page state: `?tab=&page=&q=&c=` (the store is the top bar's active store).
 *
 * Everything that decides WHICH requests are listed lives in the query string,
 * so a filtered view is shareable and survives a refresh. Defaults are omitted
 * from the URL, and every filter change drops `page` back to 1 — otherwise a
 * narrowed result set leaves the seller on an empty page.
 */

import { CancellationTab } from '@repo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { CancellationsUrlParam, UseCancellationsUrlStateResult } from '../../cancellations.types';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';

export const CANCELLATIONS_DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
/** The URL carries strings; this is the tab value that is omitted from it. */
const DEFAULT_TAB_PARAM: string = CancellationTab.ALL;

const isTab = (value: string | null): value is CancellationTab =>
  value !== null && (Object.values(CancellationTab) as string[]).includes(value);

export function useCancellationsUrlState(): UseCancellationsUrlStateResult {
  const [params, setParams] = useSearchParams();

  const tabParam = params.get('tab');
  const tab = isTab(tabParam) ? tabParam : CancellationTab.ALL;
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);
  // The store is the top bar's active store (`?store=` mirrors it; a switch
  // drops every other param, so the list starts over on page 1).
  const store = useActiveStore().activeStoreId ?? '';
  const search = (params.get('q') ?? '').trim();
  // The open request. Not a filter: it does not touch the page or the tab.
  const selected = params.get('c') ?? '';

  /* Captured once: only a bare `/cancellations` may be opened on "Needs action" by
     the container. Reading it live would bounce a seller back to that tab the
     moment they cleared their filters. */
  const openedWithSelection = useRef(Boolean(tabParam || search || params.get('page') || params.get('c'))).current;

  const [searchInput, setSearchInput] = useState(search);
  const [rowsPerPage, setRowsPerPageState] = useState(CANCELLATIONS_DEFAULT_PAGE_SIZE);

  const patch = useCallback(
    (changes: Partial<Record<CancellationsUrlParam, string | null>>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        const isDefault =
          value === null ||
          value === undefined ||
          value === '' ||
          (key === 'page' && value === '1') ||
          (key === 'tab' && value === DEFAULT_TAB_PARAM);
        if (isDefault) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  // The box updates on every keystroke; the URL (and so the request) follows 300 ms later.
  useEffect(() => {
    const term = searchInput.trim();
    if (term === search) {
      return undefined;
    }
    const handle = window.setTimeout(() => patch({ q: term, page: null }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, search, patch]);

  const setTab = useCallback((value: CancellationTab) => patch({ tab: value, page: null }), [patch]);
  const setPage = useCallback((value: number) => patch({ page: String(value) }), [patch]);
  const setSelected = useCallback((id: string | null) => patch({ c: id }), [patch]);
  const setRowsPerPage = useCallback(
    (rows: number) => {
      setRowsPerPageState(rows);
      patch({ page: null });
    },
    [patch]
  );
  const clearFilters = useCallback(() => {
    setSearchInput('');
    patch({ tab: null, q: null, page: null });
  }, [patch]);

  return useMemo(
    () => ({
      state: { tab, page, store, search, selected },
      searchInput,
      rowsPerPage,
      hasActiveFilters: Boolean(search || tab !== CancellationTab.ALL),
      openedWithSelection,
      setTab,
      setPage,
      setSearchInput,
      setRowsPerPage,
      clearFilters,
      setSelected,
    }),
    [
      tab,
      page,
      store,
      search,
      selected,
      setSelected,
      searchInput,
      rowsPerPage,
      openedWithSelection,
      setTab,
      setPage,
      setRowsPerPage,
      clearFilters,
    ]
  );
}
