import { CANCELLATION_TABS, CancellationTab, type CancellationsQueryDto } from '@repo/shared';
import { getLocaleConfig, type TabNavItem, type TableColumn } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetCancellationCountsQuery, useGetCancellationsQuery } from '../api/cancellations.api';
import type { CancellationRowView } from '../cancellations.types';
import { toCancellationRowView } from '../shared/cancellation.mapper';

import { CancellationsPageComponent } from './CancellationsPage.component';
import { useCancellationsColumns } from './hooks/useCancellationsColumns';
import { useCancellationsUrlState } from './hooks/useCancellationsUrlState';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

const TAB_IDS: readonly CancellationTab[] = Object.values(CancellationTab);

const isTab = (value: string): value is CancellationTab => (TAB_IDS as readonly string[]).includes(value);

type CancellationSortKey = NonNullable<CancellationsQueryDto['sortBy']>;
/** The sortable columns — their keys are the API's `sortBy` values. */
const CANCELLATION_SORT_KEYS: CancellationSortKey[] = ['requestedAt', 'dueBy', 'refund'];
const isSortKey = (value: string): value is CancellationSortKey =>
  (CANCELLATION_SORT_KEYS as string[]).includes(value);

/**
 * eBay cancellation requests — which buyers asked to cancel, and by when eBay needs
 * the seller's answer.
 *
 * A row opens the request in the detail drawer (`?c=`), which reads it live
 * from eBay and offers the two answers eBay still lists on it.
 */
export const CancellationsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['cancellations', 'translation']);

  const {
    state: { tab, page, store, search, selected },
    searchInput,
    rowsPerPage,
    hasActiveFilters,
    openedWithSelection,
    setTab,
    setPage,
    setSearchInput,
    setRowsPerPage,
    clearFilters,
    setSelected,
  } = useCancellationsUrlState();

  // No pick = the API's own order (awaiting an answer first); the picker then reads "Requested ↓".
  const [sortBy, setSortBy] = useState<CancellationSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);

  const { data, isLoading, isFetching } = useGetCancellationsQuery(
    {
      page,
      limit: rowsPerPage,
      tab,
      ebayAccountId: store || undefined,
      search: search || undefined,
      sortBy: sortBy ?? undefined,
      sortOrder: sortDirection,
    },
    { refetchOnMountOrArgChange: true, skip: !store }
  );
  const totalCount = data?.total ?? 0;

  /* The tab counts describe the whole store (or the filtered store), never the
     current tab or search — they make the rail legible, they are not a second
     result count. */
  const { data: counts } = useGetCancellationCountsQuery(
    { ebayAccountId: store || undefined },
    { refetchOnMountOrArgChange: true, skip: !store }
  );

  const countFor = useCallback(
    (tabId: CancellationTab): number =>
      counts ? CANCELLATION_TABS[tabId].reduce((sum, bucket) => sum + (counts[bucket] ?? 0), 0) : 0,
    [counts]
  );

  const tabItems = useMemo<TabNavItem[]>(
    () =>
      TAB_IDS.map((tabId) => ({
        id: tabId,
        label: t(`cancellations.tabs.${tabId}`),
        // A count pill beside the label, as on the orders page — never baked into the label.
        count: tabId === CancellationTab.ALL || !counts ? undefined : countFor(tabId),
      })),
    [countFor, counts, t]
  );

  /* Open on "Needs action" when something is waiting and the URL chose
     nothing — once per mount, so a seller who then clicks "All" is not bounced
     back on the next refetch. */
  const defaultedTab = useRef(false);
  useEffect(() => {
    if (defaultedTab.current || !counts || openedWithSelection) {
      return;
    }
    defaultedTab.current = true;
    if (tab === CancellationTab.ALL && countFor(CancellationTab.ACTION) > 0) {
      setTab(CancellationTab.ACTION);
    }
  }, [counts, openedWithSelection, tab, countFor, setTab]);

  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  /* Money renders in the currency eBay reported on the request, else in the
     marketplace currency of the store it belongs to — never the UI language. */
  const rows = useMemo<CancellationRowView[]>(
    () =>
      (data?.items ?? []).map((item) =>
        toCancellationRowView(item, {
          translate: (key, options) => t(key, options ?? {}),
          locale,
          currencyFor: (ebayAccountId) => resolveStoreCurrency(accounts, ebayAccountId),
        })
      ),
    [data?.items, accounts, locale, t]
  );

  const allColumns = useCancellationsColumns();

  // Same column manager as the listings and orders tables: hide and reorder; the product stays.
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const orderedKeys = useMemo(() => {
    const keys = allColumns.map((column) => column.key);
    return [...columnOrder.filter((key) => keys.includes(key)), ...keys.filter((key) => !columnOrder.includes(key))];
  }, [allColumns, columnOrder]);
  const columns = useMemo(
    () =>
      orderedKeys
        .filter((key) => !hiddenColumnKeys.includes(key))
        .map((key) => allColumns.find((column) => column.key === key))
        .filter((column): column is TableColumn<CancellationRowView> => Boolean(column)),
    [allColumns, hiddenColumnKeys, orderedKeys]
  );
  const columnOptions = useMemo(
    () =>
      orderedKeys.map((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        return {
          key,
          label: typeof column?.header === 'string' ? column.header : key,
          alwaysVisible: key === 'product',
        };
      }),
    [allColumns, orderedKeys]
  );
  const visibleColumnKeys = useMemo(
    () => orderedKeys.filter((key) => !hiddenColumnKeys.includes(key)),
    [hiddenColumnKeys, orderedKeys]
  );
  const handleToggleColumn = useCallback((key: string) => {
    setHiddenColumnKeys((current) =>
      current.includes(key) ? current.filter((columnKey) => columnKey !== key) : [...current, key]
    );
  }, []);
  const handleMoveColumn = useCallback(
    (key: string, direction: -1 | 1) => {
      const index = orderedKeys.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= orderedKeys.length) {
        return;
      }
      const next = [...orderedKeys];
      [next[index], next[target]] = [next[target], next[index]];
      setColumnOrder(next);
    },
    [orderedKeys]
  );

  const sortOptions = useMemo(
    () =>
      CANCELLATION_SORT_KEYS.flatMap((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        const label = typeof column?.header === 'string' ? column.header : key;
        return [
          { value: `${key}:desc`, label: `${label} ↓` },
          { value: `${key}:asc`, label: `${label} ↑` },
        ];
      }),
    [allColumns]
  );
  const handleSortChange = useCallback(
    (value: string | number) => {
      const [nextKey, nextDirection] = String(value).split(':');
      if (!isSortKey(nextKey)) {
        return;
      }
      setSortBy(nextKey);
      setSortDirection(nextDirection === 'asc' ? 'asc' : 'desc');
      setPage(1);
    },
    [setPage]
  );
  const handleColumnSort = useCallback(
    (columnKey: string) => {
      if (!isSortKey(columnKey)) {
        return;
      }
      setSortBy(columnKey);
      setSortDirection((current) => (sortBy === columnKey && current === 'desc' ? 'asc' : 'desc'));
      setPage(1);
    },
    [setPage, sortBy]
  );

  const handleTabChange = useCallback((tabId: string) => setTab(isTab(tabId) ? tabId : CancellationTab.ALL), [setTab]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value),
    [setSearchInput]
  );

  /* Every row opens — a request filed against an order we do not hold still
     has a history, a deadline and actions of its own. */
  const handleRowOpen = useCallback((row: CancellationRowView) => setSelected(row.id), [setSelected]);
  const handleCloseDetail = useCallback(() => setSelected(null), [setSelected]);

  return (
    <EbayAccountGuard>
      <CancellationsPageComponent
        rows={rows}
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={handleToggleColumn}
        onMoveColumn={handleMoveColumn}
        sortOptions={sortOptions}
        sortValue={sortBy ? `${sortBy}:${sortDirection}` : 'requestedAt:desc'}
        onSortChange={handleSortChange}
        sortColumn={sortBy ?? undefined}
        sortDirection={sortDirection}
        onSort={handleColumnSort}
        pagination={{
          count: totalCount,
          page,
          rowsPerPage,
          onPageChange: setPage,
          onRowsPerPageChange: setRowsPerPage,
          labelRowsPerPage: t('translation:common.rowsPerPage'),
          labelInfo: t('translation:common.showing_info'),
        }}
        tab={tab}
        tabItems={tabItems}
        onTabChange={handleTabChange}
        search={searchInput}
        onSearchChange={handleSearchChange}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        isInitialLoading={isLoading || isFetching}
        onRowOpen={handleRowOpen}
        selectedCancellationId={selected || null}
        onCloseDetail={handleCloseDetail}
      />
    </EbayAccountGuard>
  );
};
