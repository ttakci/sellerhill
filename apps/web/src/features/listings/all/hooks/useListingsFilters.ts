import { ListingStatus, ListingTrackingState, type ListingsQueryDto } from '@repo/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import type { ListingsFilterState } from '../../shared/listings-filter.types';

export const DEFAULT_LISTINGS_FILTERS: ListingsFilterState = {
  search: '',
  category: '',
  status: ListingStatus.ACTIVE,
  trackingState: '',
  ebayAccountId: '',
  price: { min: '', max: '' },
  purchasePrice: { min: '', max: '' },
  estimatedProfit: { min: '', max: '' },
  roi: { min: '', max: '' },
  profitMargin: { min: '', max: '' },
  soldCount: { min: '', max: '' },
  watchCount: { min: '', max: '' },
  viewCount: { min: '', max: '' },
  quantity: { min: '', max: '' },
  sourceStock: { min: '', max: '' },
};

const RANGE_KEYS = [
  'price',
  'purchasePrice',
  'estimatedProfit',
  'roi',
  'profitMargin',
  'soldCount',
  'watchCount',
  'viewCount',
  'quantity',
  'sourceStock',
] as const;

type RangeKey = (typeof RANGE_KEYS)[number];

/** Map UI range field → API min/max query keys */
const RANGE_QUERY_KEYS: Record<RangeKey, { min: keyof ListingsQueryDto; max: keyof ListingsQueryDto }> = {
  price: { min: 'priceMin', max: 'priceMax' },
  purchasePrice: { min: 'purchasePriceMin', max: 'purchasePriceMax' },
  estimatedProfit: { min: 'estimatedProfitMin', max: 'estimatedProfitMax' },
  roi: { min: 'roiMin', max: 'roiMax' },
  profitMargin: { min: 'profitMarginMin', max: 'profitMarginMax' },
  soldCount: { min: 'soldCountMin', max: 'soldCountMax' },
  watchCount: { min: 'watchCountMin', max: 'watchCountMax' },
  viewCount: { min: 'viewCountMin', max: 'viewCountMax' },
  quantity: { min: 'quantityMin', max: 'quantityMax' },
  sourceStock: { min: 'sourceStockMin', max: 'sourceStockMax' },
};

const readRange = (params: URLSearchParams, field: RangeKey): { min: string; max: string } => {
  const keys = RANGE_QUERY_KEYS[field];
  return {
    min: params.get(String(keys.min)) ?? '',
    max: params.get(String(keys.max)) ?? '',
  };
};

const parseNum = (v: string): number | undefined => {
  if (v === '' || v === undefined) {
    return undefined;
  }
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

/**
 * ListingsAll query state: URL-synced filters + debounced search + server query DTO.
 * Filtering/sorting/pagination happen on the API — this hook only owns UI state.
 */
export function useListingsFilters() {
  const { t } = useTranslation(['listings', 'translation']);
  const [searchParams, setSearchParams] = useSearchParams();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Local search input (immediate) → debounced into URL
  const [searchInput, setSearchInput] = useState(() => searchParams.get('q') ?? '');

  const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
  const rowsPerPage = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '10') || 10));
  const sortColumn = searchParams.get('sort') ?? '';
  const sortDirection = (searchParams.get('dir') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

  const soldFrom = searchParams.get('soldFrom') ?? '';
  const soldTo = searchParams.get('soldTo') ?? '';
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const hasSoldPeriod = Boolean(soldFrom || soldTo);

  const filters: ListingsFilterState = useMemo(
    () => ({
      search: searchParams.get('q') ?? '',
      category: searchParams.get('category') ?? '',
      // Default active listings; sold-period (dashboard) defaults to all non-draft
      status:
        searchParams.get('status') ??
        (searchParams.get('tracking') === 'untracked' || hasSoldPeriod ? '' : ListingStatus.ACTIVE),
      trackingState: searchParams.get('tracking') ?? '',
      ebayAccountId: searchParams.get('store') ?? '',
      price: readRange(searchParams, 'price'),
      purchasePrice: readRange(searchParams, 'purchasePrice'),
      estimatedProfit: readRange(searchParams, 'estimatedProfit'),
      roi: readRange(searchParams, 'roi'),
      profitMargin: readRange(searchParams, 'profitMargin'),
      soldCount: readRange(searchParams, 'soldCount'),
      watchCount: readRange(searchParams, 'watchCount'),
      viewCount: readRange(searchParams, 'viewCount'),
      quantity: readRange(searchParams, 'quantity'),
      sourceStock: readRange(searchParams, 'sourceStock'),
    }),
    [searchParams, hasSoldPeriod]
  );

  // Keep local search box in sync when URL is cleared externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Debounce search → URL
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const current = searchParams.get('q') ?? '';
      if (searchInput === current) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      if (searchInput.trim()) {
        next.set('q', searchInput.trim());
      } else {
        next.delete('q');
      }
      next.set('page', '1');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on searchInput change
  }, [searchInput]);

  const patchParams = useCallback(
    (mutate: (next: URLSearchParams) => void, resetPage = true) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      if (resetPage) {
        next.set('page', '1');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setPage = useCallback(
    (p: number) => {
      patchParams((next) => {
        next.set('page', String(Math.max(1, p)));
      }, false);
    },
    [patchParams]
  );

  const handleRowsPerPageChange = useCallback(
    (val: number) => {
      patchParams((next) => {
        next.set('limit', String(val));
      }, true);
    },
    [patchParams]
  );

  const handleSort = useCallback(
    (columnKey: string) => {
      patchParams((next) => {
        const currentSort = next.get('sort') ?? '';
        const currentDir = next.get('dir') === 'desc' ? 'desc' : 'asc';
        if (currentSort === columnKey) {
          next.set('dir', currentDir === 'asc' ? 'desc' : 'asc');
        } else {
          next.set('sort', columnKey);
          next.set('dir', 'asc');
        }
      }, true);
    },
    [patchParams]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleCategoryChange = useCallback(
    (value: string | number) => {
      patchParams((next) => {
        const v = String(value);
        if (v) {
          next.set('category', v);
        } else {
          next.delete('category');
        }
      }, true);
    },
    [patchParams]
  );

  const handleStatusChange = useCallback(
    (value: string | number) => {
      patchParams((next) => {
        const v = String(value);
        if (v) {
          next.set('status', v);
        } else {
          next.delete('status');
        }
      }, true);
    },
    [patchParams]
  );

  const handleTrackingStateChange = useCallback(
    (value: string | number) => {
      patchParams((next) => {
        const v = String(value);
        if (v) {next.set('tracking', v);} else {next.delete('tracking');}
        if (v === 'untracked') {next.delete('status');}
      }, true);
    },
    [patchParams]
  );

  const handleEbayAccountChange = useCallback(
    (value: string | number) => {
      patchParams((next) => {
        const v = String(value);
        if (v) {
          next.set('store', v);
        } else {
          next.delete('store');
        }
      }, true);
    },
    [patchParams]
  );

  const handleRangeChange = useCallback(
    (field: RangeKey, bound: 'min' | 'max') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const key = String(RANGE_QUERY_KEYS[field][bound]);
      patchParams((next) => {
        if (val === '') {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      }, true);
    },
    [patchParams]
  );

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    // Preserve draft-only view when clearing other filters
    const next = new URLSearchParams();
    if (String(filters.status) === String(ListingStatus.DRAFT)) {
      next.set('status', ListingStatus.DRAFT);
    }
    // Keep dashboard sold-period context if present
    if (soldFrom) {
      next.set('soldFrom', soldFrom);
    }
    if (soldTo) {
      next.set('soldTo', soldTo);
    }
    if (fromDashboard) {
      next.set('from', 'dashboard');
    }
    setSearchParams(next, { replace: true });
  }, [setSearchParams, filters.status, soldFrom, soldTo, fromDashboard]);

  const hasActiveFilters = useMemo(() => {
    // Active is the default — not "active filter" for clear button
    // Draft mode is a dedicated view; status alone should not force "clear" chrome
    const isDraftView = String(filters.status) === String(ListingStatus.DRAFT);
    const nonDefaultStatus =
      Boolean(filters.status) &&
      String(filters.status) !== String(ListingStatus.ACTIVE) &&
      !isDraftView &&
      !hasSoldPeriod;
    if (filters.search || filters.category || nonDefaultStatus || filters.trackingState || filters.ebayAccountId) {
      return true;
    }
    return RANGE_KEYS.some((k) => filters[k].min !== '' || filters[k].max !== '');
  }, [filters, hasSoldPeriod]);

  /** Query sent to RTK / API (debounced search already in URL). */
  const serverQuery: ListingsQueryDto = useMemo(() => {
    const q: ListingsQueryDto = {
      page,
      limit: rowsPerPage,
      search: filters.search || undefined,
      category: filters.category || undefined,
      status: filters.status || undefined,
      trackingState: Object.values(ListingTrackingState).find(
        (state) => String(state) === filters.trackingState
      ),
      ebayAccountId: filters.ebayAccountId || undefined,
      // Default sort: last sale when filtering by sold period, else newest
      sortBy: sortColumn || (hasSoldPeriod ? 'lastSale' : 'createdAt'),
      sortOrder: sortColumn ? sortDirection : 'desc',
      soldFrom: soldFrom || undefined,
      soldTo: soldTo || undefined,
    };

    const assignRange = (minKey: keyof ListingsQueryDto, maxKey: keyof ListingsQueryDto, range: { min: string; max: string }) => {
      const min = parseNum(range.min);
      const max = parseNum(range.max);
      if (min !== undefined) {
        q[minKey] = min as never;
      }
      if (max !== undefined) {
        q[maxKey] = max as never;
      }
    };

    assignRange('priceMin', 'priceMax', filters.price);
    assignRange('purchasePriceMin', 'purchasePriceMax', filters.purchasePrice);
    assignRange('estimatedProfitMin', 'estimatedProfitMax', filters.estimatedProfit);
    assignRange('roiMin', 'roiMax', filters.roi);
    assignRange('profitMarginMin', 'profitMarginMax', filters.profitMargin);
    assignRange('soldCountMin', 'soldCountMax', filters.soldCount);
    assignRange('watchCountMin', 'watchCountMax', filters.watchCount);
    assignRange('viewCountMin', 'viewCountMax', filters.viewCount);
    assignRange('quantityMin', 'quantityMax', filters.quantity);
    assignRange('sourceStockMin', 'sourceStockMax', filters.sourceStock);

    return q;
  }, [page, rowsPerPage, filters, sortColumn, sortDirection, soldFrom, soldTo, hasSoldPeriod]);

  /** Operational statuses only — draft / error / retrying are job/pipeline states, not list UI. */
  const statusOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allStatuses') },
      { value: ListingStatus.ACTIVE, label: t('listings.status.active') },
      { value: ListingStatus.INACTIVE, label: t('listings.status.inactive') },
    ],
    [t]
  );

  const trackingOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allTrackingStates') },
      { value: 'tracked', label: t('listings.tracking.tracked') },
      { value: 'untracked', label: t('listings.tracking.untracked') },
    ],
    [t]
  );

  const numericFilters = useMemo(
    () =>
      (
        [
          { key: 'price' as const, label: t('listings.filters.fields.price') },
          { key: 'purchasePrice' as const, label: t('listings.filters.fields.purchasePrice') },
          { key: 'estimatedProfit' as const, label: t('listings.filters.fields.estimatedProfit') },
          { key: 'roi' as const, label: t('listings.filters.fields.roi') },
          { key: 'profitMargin' as const, label: t('listings.filters.fields.profitMargin') },
          { key: 'soldCount' as const, label: t('listings.filters.fields.soldCount') },
          { key: 'watchCount' as const, label: t('listings.filters.fields.watchCount') },
          { key: 'viewCount' as const, label: t('listings.filters.fields.viewCount') },
          { key: 'quantity' as const, label: t('listings.filters.fields.quantity') },
          { key: 'sourceStock' as const, label: t('listings.filters.fields.sourceStock') },
        ] as const
      ).map(({ key, label }) => ({
        key,
        label,
        min: filters[key].min,
        max: filters[key].max,
        onMinChange: handleRangeChange(key, 'min'),
        onMaxChange: handleRangeChange(key, 'max'),
      })),
    [filters, t, handleRangeChange]
  );

  /** Local display filters with live search input (not yet debounced into URL). */
  const displayFilters: ListingsFilterState = useMemo(
    () => ({
      ...filters,
      search: searchInput,
    }),
    [filters, searchInput]
  );

  return {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    sortColumn,
    sortDirection,
    handleSort,
    filters: displayFilters,
    serverQuery,
    advancedOpen,
    setAdvancedOpen,
    handleSearchChange,
    handleCategoryChange,
    handleStatusChange,
    handleTrackingStateChange,
    handleEbayAccountChange,
    handleClearFilters,
    hasActiveFilters,
    statusOptions,
    trackingOptions,
    numericFilters,
    fromDashboard,
    hasSoldPeriod,
  };
}
