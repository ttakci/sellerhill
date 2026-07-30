/**
 * URL-backed dashboard state: active tab, selected period card, store filter
 * and chart granularity. Keeping it in the query string makes every dashboard
 * view shareable and survives a refresh.
 */

import { DashboardChartGranularity, DashboardPeriodKey, DashboardTab } from '@repo/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { DashboardUrlState } from '../dashboard.types';

const PARAM_TAB = 'tab';
const PARAM_PERIOD = 'period';
const PARAM_STORE = 'store';
const PARAM_GRANULARITY = 'granularity';

export const ALL_STORES = 'all';

const DEFAULT_TAB = DashboardTab.CARDS;
const DEFAULT_PERIOD = DashboardPeriodKey.TODAY;
const DEFAULT_GRANULARITY = DashboardChartGranularity.MONTH;

const parseEnum = <T extends string>(raw: string | null, allowed: T[], fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback;

export function useDashboardUrlState(): DashboardUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = parseEnum(searchParams.get(PARAM_TAB), Object.values(DashboardTab), DEFAULT_TAB);
  const period = parseEnum(
    searchParams.get(PARAM_PERIOD),
    Object.values(DashboardPeriodKey),
    DEFAULT_PERIOD,
  );
  const granularity = parseEnum(
    searchParams.get(PARAM_GRANULARITY),
    Object.values(DashboardChartGranularity),
    DEFAULT_GRANULARITY,
  );
  const storeId = searchParams.get(PARAM_STORE) ?? ALL_STORES;

  const patch = useCallback(
    (param: string, value: string, defaultValue: string) => {
      const next = new URLSearchParams(searchParams);
      if (value === defaultValue) {
        next.delete(param);
      } else {
        next.set(param, value);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setTab = useCallback(
    (value: DashboardTab) => patch(PARAM_TAB, value, DEFAULT_TAB),
    [patch],
  );
  const setPeriod = useCallback(
    (value: DashboardPeriodKey) => patch(PARAM_PERIOD, value, DEFAULT_PERIOD),
    [patch],
  );
  const setStoreId = useCallback(
    (value: string) => patch(PARAM_STORE, value, ALL_STORES),
    [patch],
  );
  const setGranularity = useCallback(
    (value: DashboardChartGranularity) => patch(PARAM_GRANULARITY, value, DEFAULT_GRANULARITY),
    [patch],
  );

  return useMemo(
    () => ({ tab, period, storeId, granularity, setTab, setPeriod, setStoreId, setGranularity }),
    [tab, period, storeId, granularity, setTab, setPeriod, setStoreId, setGranularity],
  );
}
