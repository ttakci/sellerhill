/**
 * URL-backed dashboard state: active tab, the date range (a preset or a
 * custom from/to), the selected period card and the top sellers' sort and
 * page (the store is the top bar's
 * active store, `useActiveStore`). Keeping it in the query string makes every
 * dashboard view shareable and survives a refresh. Chart and P&L bucket sizes
 * are not here — the API derives them from the range.
 */

import {
  DASHBOARD_CARD_COUNT,
  DashboardRangePreset,
  DashboardTab,
  DEFAULT_DASHBOARD_RANGE_PRESET,
  DEFAULT_TOP_LISTING_SORT,
  isIsoDate,
  TopListingSortKey,
  type DashboardRangeInput,
} from '@repo/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { DashboardUrlState } from '../dashboard.types';

const PARAM_TAB = 'tab';
const PARAM_RANGE = 'range';
const PARAM_FROM = 'from';
const PARAM_TO = 'to';
const PARAM_CARD = 'card';
const PARAM_TOP_SORT = 'tsort';
const PARAM_TOP_PAGE = 'tpage';
/** Bookmarks from before the range picker carried `?period=`; its four values are presets of the same name. */
const PARAM_LEGACY_PERIOD = 'period';
const LEGACY_PERIODS: string[] = ['today', 'thisWeek', 'thisMonth', 'thisYear'];
const DEFAULT_TAB = DashboardTab.CARDS;

export function useDashboardUrlState(): DashboardUrlState {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get(PARAM_TAB);
  const tab = (Object.values(DashboardTab) as string[]).includes(rawTab ?? '') ? (rawTab as DashboardTab) : DEFAULT_TAB;

  const from = searchParams.get(PARAM_FROM) ?? '';
  const to = searchParams.get(PARAM_TO) ?? '';
  const legacyPeriod = searchParams.get(PARAM_LEGACY_PERIOD) ?? '';
  const hasNewParams = searchParams.has(PARAM_RANGE) || searchParams.has(PARAM_FROM) || searchParams.has(PARAM_TO);
  const rawRange =
    searchParams.get(PARAM_RANGE) ?? (!hasNewParams && LEGACY_PERIODS.includes(legacyPeriod) ? legacyPeriod : '');
  const rangeKey = isIsoDate(from) && isIsoDate(to) ? `c:${from}:${to}` : `p:${rawRange}`;
  const range = useMemo<DashboardRangeInput>(() => {
    if (rangeKey.startsWith('c:')) {
      return { from, to };
    }
    return (Object.values(DashboardRangePreset) as string[]).includes(rawRange)
      ? { preset: rawRange as DashboardRangePreset }
      : { preset: DEFAULT_DASHBOARD_RANGE_PRESET };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const rawCard = Number(searchParams.get(PARAM_CARD));
  const card = Number.isInteger(rawCard) && rawCard > 0 && rawCard < DASHBOARD_CARD_COUNT ? rawCard : 0;

  const rawTopSort = searchParams.get(PARAM_TOP_SORT) ?? '';
  const topSort = (Object.values(TopListingSortKey) as string[]).includes(rawTopSort)
    ? (rawTopSort as TopListingSortKey)
    : DEFAULT_TOP_LISTING_SORT;
  const rawTopPage = Number(searchParams.get(PARAM_TOP_PAGE));
  const topPage = Number.isInteger(rawTopPage) && rawTopPage > 1 ? rawTopPage : 1;

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setTab = useCallback(
    (value: DashboardTab) => update((n) => (value === DEFAULT_TAB ? n.delete(PARAM_TAB) : n.set(PARAM_TAB, value))),
    [update],
  );

  const setRange = useCallback(
    (value: DashboardRangeInput) =>
      update((n) => {
        n.delete(PARAM_CARD);
        n.delete(PARAM_TOP_PAGE);
        n.delete(PARAM_RANGE);
        n.delete(PARAM_FROM);
        n.delete(PARAM_TO);
        if ('preset' in value) {
          if (value.preset !== DEFAULT_DASHBOARD_RANGE_PRESET) {
            n.set(PARAM_RANGE, value.preset);
          }
        } else {
          n.set(PARAM_FROM, value.from);
          n.set(PARAM_TO, value.to);
        }
      }),
    [update],
  );

  const setCard = useCallback(
    (value: number) => update((n) => (value === 0 ? n.delete(PARAM_CARD) : n.set(PARAM_CARD, String(value)))),
    [update],
  );

  // A new order puts a different listing first: back to page 1.
  const setTopSort = useCallback(
    (value: TopListingSortKey) =>
      update((n) => {
        n.delete(PARAM_TOP_PAGE);
        if (value === DEFAULT_TOP_LISTING_SORT) {
          n.delete(PARAM_TOP_SORT);
        } else {
          n.set(PARAM_TOP_SORT, value);
        }
      }),
    [update],
  );

  const setTopPage = useCallback(
    (value: number) => update((n) => (value <= 1 ? n.delete(PARAM_TOP_PAGE) : n.set(PARAM_TOP_PAGE, String(value)))),
    [update],
  );

  return useMemo(
    () => ({ tab, range, card, topSort, topPage, setTab, setRange, setCard, setTopSort, setTopPage }),
    [tab, range, card, topSort, topPage, setTab, setRange, setCard, setTopSort, setTopPage],
  );
}
