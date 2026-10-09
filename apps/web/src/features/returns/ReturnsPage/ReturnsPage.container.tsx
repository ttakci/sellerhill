import { RETURN_TABS, ReturnBucket, ReturnTab, type EbayReturnDto, type ReturnsQueryDto } from '@repo/shared';
import { getLocaleConfig, type IconName, type TabNavItem, type TableColumn } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetReturnCountsQuery, useGetReturnsQuery } from '../api/returns.api';
import type { ReturnRowView } from '../returns.types';
import { returnBucketPresentation } from '../shared/return-presentation';
import { toReturnRowView } from '../shared/return-row.mapper';

import { useReturnsColumns } from './hooks/useReturnsColumns';
import { useReturnsExport } from './hooks/useReturnsExport';
import { useReturnsUrlState } from './hooks/useReturnsUrlState';
import { ReturnsPageComponent } from './ReturnsPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import type { StatusLegendRow } from '@/components/StatusLegend/StatusLegend.types';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

const TAB_IDS: readonly ReturnTab[] = Object.values(ReturnTab);

/** The Orders rail's icons for the same meanings. */
const RETURN_TAB_ICON: Record<ReturnTab, IconName> = {
  [ReturnTab.ALL]: 'format-list-bulleted',
  [ReturnTab.ACTION]: 'shield-alert',
  [ReturnTab.IN_PROGRESS]: 'loader',
  [ReturnTab.CLOSED]: 'check-circle',
};

const isTab = (value: string): value is ReturnTab => (TAB_IDS as readonly string[]).includes(value);

type ReturnSortKey = NonNullable<ReturnsQueryDto['sortBy']>;
/** The sortable columns — their keys are the API's `sortBy` values. */
const RETURN_SORT_KEYS: ReturnSortKey[] = ['openedAt', 'dueBy', 'refund'];
const isSortKey = (value: string): value is ReturnSortKey => (RETURN_SORT_KEYS as string[]).includes(value);

/**
 * eBay returns — which ones need the seller, what exactly is due, and by when.
 *
 * A row opens the return in the detail drawer (`?r=`), which reads it live
 * from eBay and offers the in-app actions eBay lists on it; anything else is
 * answered on eBay through the drawer's link.
 */
export const ReturnsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['returns', 'translation']);

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
  } = useReturnsUrlState();

  // No pick = the API's own order (what needs the seller first); the picker then reads "Opened ↓".
  const [sortBy, setSortBy] = useState<ReturnSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);

  /* What the export reads: the list's own filters, every page. */
  const exportQuery = useMemo(
    () => ({
      tab,
      ebayAccountId: store || undefined,
      search: search || undefined,
      sortBy: sortBy ?? undefined,
      sortOrder: sortDirection,
    }),
    [tab, store, search, sortBy, sortDirection]
  );

  const { data, isLoading, isFetching } = useGetReturnsQuery(
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
  const { data: counts } = useGetReturnCountsQuery(
    { ebayAccountId: store || undefined },
    { refetchOnMountOrArgChange: true, skip: !store }
  );

  const countFor = useCallback(
    (tabId: ReturnTab): number =>
      counts ? RETURN_TABS[tabId].reduce((sum, bucket) => sum + (counts[bucket] ?? 0), 0) : 0,
    [counts]
  );

  // Every status the badge can show, with what it means — the orders page's legend, for returns.
  const legendRows = useMemo<StatusLegendRow[]>(
    () =>
      Object.values(ReturnBucket).map((bucket) => ({
        key: bucket,
        label: t(`returns.bucket.${bucket}`),
        meaning: t(`returns.bucketHint.${bucket}`),
        ...returnBucketPresentation(bucket),
      })),
    [t]
  );

  const tabItems = useMemo<TabNavItem[]>(
    () =>
      TAB_IDS.map((tabId) => ({
        id: tabId,
        label: t(`returns.tabs.${tabId}`),
        icon: RETURN_TAB_ICON[tabId],
        // A count pill beside the label, as on the orders page — never baked into the label.
        count: tabId === ReturnTab.ALL || !counts ? undefined : countFor(tabId),
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
    if (tab === ReturnTab.ALL && countFor(ReturnTab.ACTION) > 0) {
      setTab(ReturnTab.ACTION);
    }
  }, [counts, openedWithSelection, tab, countFor, setTab]);

  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  /* Money renders in the currency eBay reported on the return, else in the
     marketplace currency of the store it belongs to — never the UI language. */
  const toRow = useCallback(
    (item: EbayReturnDto): ReturnRowView =>
      toReturnRowView(item, {
        translate: (key, options) => t(key, options ?? {}),
        locale,
        currencyFor: (ebayAccountId) => resolveStoreCurrency(accounts, ebayAccountId),
      }),
    [accounts, locale, t]
  );

  const rows = useMemo<ReturnRowView[]>(() => (data?.items ?? []).map(toRow), [data?.items, toRow]);

  const allColumns = useReturnsColumns();

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
        .filter((column): column is TableColumn<ReturnRowView> => Boolean(column)),
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
      RETURN_SORT_KEYS.flatMap((key) => {
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

  const handleTabChange = useCallback((tabId: string) => setTab(isTab(tabId) ? tabId : ReturnTab.ALL), [setTab]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value),
    [setSearchInput]
  );

  /* Every row opens — a return filed against an order we do not hold still
     has a history, a deadline and actions of its own. */
  const handleRowOpen = useCallback((row: ReturnRowView) => setSelected(row.id), [setSelected]);
  const handleCloseDetail = useCallback(() => setSelected(null), [setSelected]);

  const { exportCsv } = useReturnsExport(exportQuery, toRow);

  return (
    <EbayAccountGuard>
      <ReturnsPageComponent
        onDownload={() => void exportCsv()}
        rows={rows}
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={handleToggleColumn}
        onMoveColumn={handleMoveColumn}
        sortOptions={sortOptions}
        sortValue={sortBy ? `${sortBy}:${sortDirection}` : 'openedAt:desc'}
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
        legendRows={legendRows}
        onTabChange={handleTabChange}
        search={searchInput}
        onSearchChange={handleSearchChange}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={totalCount}
        isInitialLoading={isLoading || isFetching}
        onRowOpen={handleRowOpen}
        selectedReturnId={selected || null}
        onCloseDetail={handleCloseDetail}
      />
    </EbayAccountGuard>
  );
};
