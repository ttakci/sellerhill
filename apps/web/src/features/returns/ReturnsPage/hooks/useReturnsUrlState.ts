/**
 * URL-backed Returns page state: `?tab=&page=&store=&q=`.
 *
 * Everything that decides WHICH returns are listed lives in the query string,
 * so a filtered view is shareable and survives a refresh. Defaults are omitted
 * from the URL, and every filter change drops `page` back to 1 — otherwise a
 * narrowed result set leaves the seller on an empty page.
 */

import { ReturnTab } from '@repo/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ReturnsUrlParam, UseReturnsUrlStateResult } from '../../returns.types';

export const RETURNS_DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
/** The URL carries strings; this is the tab value that is omitted from it. */
const DEFAULT_TAB_PARAM: string = ReturnTab.ALL;

const isTab = (value: string | null): value is ReturnTab =>
  value !== null && (Object.values(ReturnTab) as string[]).includes(value);

export function useReturnsUrlState(): UseReturnsUrlStateResult {
  const [params, setParams] = useSearchParams();

  const tabParam = params.get('tab');
  const tab = isTab(tabParam) ? tabParam : ReturnTab.ALL;
  const page = Math.max(1, Math.floor(Number(params.get('page') ?? '1')) || 1);
  const store = params.get('store') ?? '';
  const search = (params.get('q') ?? '').trim();

  /* Captured once: only a bare `/returns` may be opened on "Needs action" by
     the container. Reading it live would bounce a seller back to that tab the
     moment they cleared their filters. */
  const openedWithSelection = useRef(Boolean(tabParam || store || search || params.get('page'))).current;

  const [searchInput, setSearchInput] = useState(search);
  const [rowsPerPage, setRowsPerPageState] = useState(RETURNS_DEFAULT_PAGE_SIZE);

  const patch = useCallback(
    (changes: Partial<Record<ReturnsUrlParam, string | null>>) => {
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

  const setTab = useCallback((value: ReturnTab) => patch({ tab: value, page: null }), [patch]);
  const setPage = useCallback((value: number) => patch({ page: String(value) }), [patch]);
  const setStore = useCallback((value: string) => patch({ store: value, page: null }), [patch]);
  const setRowsPerPage = useCallback(
    (rows: number) => {
      setRowsPerPageState(rows);
      patch({ page: null });
    },
    [patch]
  );
  const clearFilters = useCallback(() => {
    setSearchInput('');
    patch({ tab: null, store: null, q: null, page: null });
  }, [patch]);

  return useMemo(
    () => ({
      state: { tab, page, store, search },
      searchInput,
      rowsPerPage,
      hasActiveFilters: Boolean(search || store || tab !== ReturnTab.ALL),
      openedWithSelection,
      setTab,
      setPage,
      setStore,
      setSearchInput,
      setRowsPerPage,
      clearFilters,
    }),
    [
      tab,
      page,
      store,
      search,
      searchInput,
      rowsPerPage,
      openedWithSelection,
      setTab,
      setPage,
      setStore,
      setRowsPerPage,
      clearFilters,
    ]
  );
}
