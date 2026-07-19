import { OrderStatus, type OrderFiltersDto } from '@repo/shared';
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

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [ebayAccountId, setEbayAccountId] = useState(storeFromUrl);
  const [needsAttention, setNeedsAttention] = useState(false);

  // Sync store from URL (e.g. deep-link from dashboard)
  useEffect(() => {
    setEbayAccountId(storeFromUrl);
  }, [storeFromUrl]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allStatuses') },
      ...Object.values(OrderStatus).map((s) => ({
        value: s,
        label: t(`orders.status.${s}`),
      })),
    ],
    [t]
  );

  const needsAttentionOptions = useMemo(
    () => [
      { value: 'false', label: t('orders.autoFulfill.filter.all') },
      { value: 'true', label: t('orders.autoFulfill.filter.needsAttention') },
    ],
    [t]
  );

  const hasActiveFilters = Boolean(
    search || status || ebayAccountId || dateFrom || dateTo || needsAttention,
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
      autoFulfillNeedsAttention: needsAttention || undefined,
      sortBy: 'order_date',
      sortOrder: 'desc',
    }),
    [page, rowsPerPage, search, status, ebayAccountId, dateFrom, dateTo, needsAttention]
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

  const handleNeedsAttentionChange = useCallback((value: string | number) => {
    setNeedsAttention(String(value) === 'true');
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setEbayAccountId('');
    setNeedsAttention(false);
    setPage(1);
    const next = new URLSearchParams();
    if (dateFrom) {
      next.set('dateFrom', dateFrom);
    }
    if (dateTo) {
      next.set('dateTo', dateTo);
    }
    if (fromDashboard) {
      next.set('from', 'dashboard');
    }
    setSearchParams(next, { replace: true });
  }, [dateFrom, dateTo, fromDashboard, setSearchParams]);

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
    needsAttention,
    needsAttentionOptions,
    handleNeedsAttentionChange,
    handleClearFilters,
    hasActiveFilters,
    serverQuery,
    fromDashboard,
    dateFrom,
    dateTo,
  };
}
