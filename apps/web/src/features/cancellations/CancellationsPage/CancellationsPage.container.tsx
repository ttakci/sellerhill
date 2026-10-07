import { CANCELLATION_TABS, CancellationTab } from '@repo/shared';
import { getLocaleConfig, type TabNavItem } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);

  const { data, isLoading, isFetching } = useGetCancellationsQuery(
    {
      page,
      limit: rowsPerPage,
      tab,
      ebayAccountId: store || undefined,
      search: search || undefined,
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
        label:
          tabId === CancellationTab.ALL
            ? t(`cancellations.tabs.${tabId}`)
            : t('cancellations.tabs.withCount', { label: t(`cancellations.tabs.${tabId}`), count: countFor(tabId) }),
      })),
    [countFor, t]
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

  const columns = useCancellationsColumns();

  const handleTabChange = useCallback((tabId: string) => setTab(isTab(tabId) ? tabId : CancellationTab.ALL), [setTab]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value),
    [setSearchInput]
  );


  /* Every row opens — a request filed against an order we do not hold still
     has a history, a deadline and actions of its own. */
  const handleRowOpen = useCallback((row: CancellationRowView) => setSelected(row.id), [setSelected]);
  const handleCloseDetail = useCallback(() => setSelected(null), [setSelected]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, row: CancellationRowView) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleRowOpen(row);
      }
    },
    [handleRowOpen]
  );

  return (
    <EbayAccountGuard>
      <CancellationsPageComponent
        rows={rows}
        columns={columns}
        pagination={{
          count: totalCount,
          page,
          rowsPerPage,
          onPageChange: setPage,
          onRowsPerPageChange: setRowsPerPage,
          labelRowsPerPage: t('translation:common.rowsPerPage'),
          labelInfo: t('translation:common.showing_info'),
        }}
        subtitle={isLoading ? t('cancellations.loading') : t('cancellations.subtitle', { count: totalCount })}
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
        onCardKeyDown={handleCardKeyDown}
        selectedCancellationId={selected || null}
        onCloseDetail={handleCloseDetail}
      />
    </EbayAccountGuard>
  );
};
