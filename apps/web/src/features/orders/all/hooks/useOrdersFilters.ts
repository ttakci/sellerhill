import {
  OrderFulfillmentState,
  OrderStatus,
  type OrderFiltersDto,
} from '@repo/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

/**
 * Orders list UI filters + server query DTO (search debounce, status, store, page, date range).
 */
export function useOrdersFilters() {
  const { t } = useTranslation(['orders', 'translation']);
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const fromDashboard = searchParams.get('from') === 'dashboard';
  const storeFromUrl = searchParams.get('store') ?? '';
  /**
   * Deep-link target for the Action Center: every one of its order rows links
   * here with the state it counted (`?fulfillmentState=action_required`). This
   * was local-only state, so those links landed on an unfiltered list showing
   * every order — the seller was told "3 need you" and handed all 400.
   */
  const fulfillmentStateFromUrl = searchParams.get('fulfillmentState') ?? '';

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [ebayAccountId, setEbayAccountId] = useState(storeFromUrl);
  const [fulfillmentState, setFulfillmentState] = useState(fulfillmentStateFromUrl);

  // Sync store from URL (e.g. deep-link from dashboard)
  useEffect(() => {
    setEbayAccountId(storeFromUrl);
  }, [storeFromUrl]);

  // Same for the fulfillment state, so navigating between two Action Center
  // rows re-filters instead of keeping the first one's selection.
  useEffect(() => {
    setFulfillmentState(fulfillmentStateFromUrl);
    setPage(1);
  }, [fulfillmentStateFromUrl]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  /**
   * eBay-side statuses the sync can actually produce. `mapOrderStatus` only ever
   * writes these four, and `completed` is set later by the Amazon tracker;
   * `cancelled` is never written at all. Offering the full enum meant two of the
   * six options could only ever return an empty list, which read as a broken
   * filter.
   */
  const statusOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allStatuses') },
      ...[
        OrderStatus.PENDING,
        OrderStatus.WAITING_SHIPMENT,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.COMPLETED,
      ].map((s) => ({ value: s, label: t(`orders.status.${s}`) })),
    ],
    [t]
  );

  /**
   * Amazon-fulfillment filter. Replaces the old two-value dropdown ("All" /
   * "Needs attention"), which could not answer the question sellers actually
   * have — which orders were bought on Amazon, which are still queued, which are
   * stuck — and whose "Needs attention" option looked broken whenever nothing
   * was blocked.
   */
  const fulfillmentStateOptions = useMemo(
    () => [
      { value: '', label: t('orders.fulfillmentState.filter.all') },
      ...[
        OrderFulfillmentState.ACTION_REQUIRED,
        OrderFulfillmentState.AMAZON_CANCELLED,
        OrderFulfillmentState.PURCHASED,
        OrderFulfillmentState.IN_PROGRESS,
        OrderFulfillmentState.NOT_AUTOMATED,
        OrderFulfillmentState.MANUAL,
        OrderFulfillmentState.SIMULATED,
      ].map((s) => ({ value: s, label: t(`orders.fulfillmentState.${s}`) })),
    ],
    [t]
  );

  const hasActiveFilters = Boolean(
    search || status || ebayAccountId || dateFrom || dateTo || fulfillmentState,
  );

  const serverQuery: OrderFiltersDto = useMemo(
    () => ({
      page,
      limit: rowsPerPage,
      search: search || undefined,
      status: (status as OrderStatus) || undefined,
      ebayAccountId: ebayAccountId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      fulfillmentState: (fulfillmentState as OrderFulfillmentState) || undefined,
      sortBy: 'order_date',
      sortOrder: 'desc',
    }),
    [page, rowsPerPage, search, status, ebayAccountId, dateFrom, dateTo, fulfillmentState]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  const handleStatusChange = useCallback((value: string | number) => {
    setStatus(String(value));
    setPage(1);
  }, []);

  const handleEbayAccountChange = useCallback(
    (value: string | number) => {
      const v = String(value);
      setEbayAccountId(v);
      setPage(1);
      const next = new URLSearchParams(searchParams);
      if (v) {
        next.set('store', v);
      } else {
        next.delete('store');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleFulfillmentStateChange = useCallback((value: string | number) => {
    setFulfillmentState(String(value));
    setPage(1);
  }, []);

  // No date-range setters here on purpose: `dateFrom`/`dateTo` are read-only
  // inbound state, arriving from the dashboard's "view all" deep link. The list
  // has no date inputs of its own, and `handleClearFilters` already drops them.

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setEbayAccountId('');
    setFulfillmentState('');
    setPage(1);
    const next = new URLSearchParams();
    if (fromDashboard) {
      next.set('from', 'dashboard');
    }
    setSearchParams(next, { replace: true });
  }, [fromDashboard, setSearchParams]);

  const handleRowsPerPageChange = useCallback((rows: number) => {
    setRowsPerPage(rows);
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    searchInput,
    handleSearchChange,
    status,
    handleStatusChange,
    statusOptions,
    ebayAccountId,
    handleEbayAccountChange,
    fulfillmentState,
    fulfillmentStateOptions,
    handleFulfillmentStateChange,
    handleClearFilters,
    hasActiveFilters,
    serverQuery,
    fromDashboard,
    dateFrom,
    dateTo,
  };
}
