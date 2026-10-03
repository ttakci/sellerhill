import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import type { ActiveStoreProviderProps } from './ActiveStoreProvider.types';

import { resolveRouteMeta } from '@/app/routeMeta';
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { ActiveStoreContext } from '@/features/ebay/hooks/useActiveStore';
import {
  nextSearchForActiveStore,
  readRememberedStore,
  recordListPath,
  rememberStore,
  resolveActiveStoreId,
  searchForStoreSwitch,
} from '@/features/ebay/utils/activeStore';
import { stripLocaleFromPath } from '@/utils/locale';

/**
 * One active eBay store for the whole seller app (design:
 * docs/superpowers/specs/2026-10-04-active-store-context-design.md).
 *
 * The choice is resolved by `resolveActiveStoreId` — the URL's `?store=` on a
 * store-scoped page (a deep link, a refresh), else this browser's remembered
 * choice, else the first store — and on store-scoped pages
 * (`AppRouteMeta.storeScoped`) the URL is kept in step with it, so a copied
 * link opens the same store. Pages never read `?store=` themselves; they read
 * `useActiveStore()`.
 */
export const ActiveStoreProvider = ({ children }: ActiveStoreProviderProps): React.ReactElement => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  // The user the auth slice already holds (AuthBootstrap / login set it before
  // the shell renders) — NOT `/auth/me`, which can answer after the store
  // list and would let the first store overwrite the remembered choice.
  const userId = useSelector(selectCurrentUser)?.id ?? null;
  const { data } = useGetEbayAccountsQuery(undefined, { skip: !isAuthenticated });
  const stores = useMemo(() => data?.items ?? [], [data?.items]);
  const storeIds = useMemo(() => stores.map((store) => store.id), [stores]);

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const path = stripLocaleFromPath(location.pathname);
  const routeMeta = resolveRouteMeta(path);
  const storeScoped = routeMeta?.storeScoped ?? false;
  const [chosen, setChosen] = useState<string | null>(null);

  const activeStoreId = useMemo(
    () =>
      resolveActiveStoreId({
        urlStoreId: storeScoped ? searchParams.get('store') : null,
        rememberedStoreId: chosen ?? readRememberedStore(userId),
        storeIds,
      }),
    [storeScoped, searchParams, chosen, userId, storeIds]
  );

  // The URL mirrors the choice on store-scoped pages (and a foreign or stale
  // `?store=` is corrected rather than sent to the API).
  useEffect(() => {
    const next = nextSearchForActiveStore(searchParams, activeStoreId, storeScoped);
    if (next) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, activeStoreId, storeScoped, setSearchParams]);

  // Whatever became active — a deep link, a record's own store — becomes the
  // choice, so leaving for a store-independent page keeps it. Adjusted during
  // render (React's pattern for state derived from a changed input), not in an
  // effect, so no frame renders the old store.
  if (activeStoreId && activeStoreId !== chosen) {
    setChosen(activeStoreId);
  }

  // …and is remembered on this browser for the next visit.
  useEffect(() => {
    if (activeStoreId) {
      rememberStore(userId, activeStoreId);
    }
  }, [activeStoreId, userId]);

  const setActiveStore = useCallback(
    (storeId: string, options?: { keepParams?: boolean }) => {
      if (!storeIds.includes(storeId)) {
        return;
      }
      setChosen(storeId);
      rememberStore(userId, storeId);
      if (!storeScoped) {
        return;
      }
      const keepParams = options?.keepParams ?? false;
      // A manual switch on a record page (an order, a listing, a job) goes to
      // that list: the record belongs to the store just left.
      const listPath = keepParams ? null : recordListPath(path, routeMeta?.path);
      if (listPath) {
        const localePrefix = location.pathname.slice(0, location.pathname.length - path.length);
        void navigate(`${localePrefix}${listPath}?${new URLSearchParams({ store: storeId }).toString()}`);
        return;
      }
      setSearchParams(searchForStoreSwitch(searchParams, storeId, keepParams), { replace: keepParams });
    },
    [storeIds, userId, storeScoped, path, routeMeta?.path, location.pathname, navigate, searchParams, setSearchParams]
  );

  const value = useMemo(() => ({ activeStoreId, stores, setActiveStore }), [activeStoreId, stores, setActiveStore]);
  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
};
