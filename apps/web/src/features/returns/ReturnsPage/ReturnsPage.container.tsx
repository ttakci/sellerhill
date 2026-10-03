import { RETURN_TABS, ReturnTab } from '@repo/shared';
import { getLocaleConfig, type TabNavItem } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetReturnCountsQuery, useGetReturnsQuery } from '../api/returns.api';
import type { ReturnRowView } from '../returns.types';
import { toReturnRowView } from '../shared/return-row.mapper';

import { useReturnsColumns } from './hooks/useReturnsColumns';
import { useReturnsUrlState } from './hooks/useReturnsUrlState';
import { ReturnsPageComponent } from './ReturnsPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { resolveRecordStoreLabel } from '@/features/ebay/utils/storeLabel';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

const TAB_IDS: readonly ReturnTab[] = Object.values(ReturnTab);

const isTab = (value: string): value is ReturnTab => (TAB_IDS as readonly string[]).includes(value);

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

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => ebayAccountsData?.items ?? [], [ebayAccountsData?.items]);

  const { data, isLoading, isFetching } = useGetReturnsQuery(
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
  const { data: counts } = useGetReturnCountsQuery(
    { ebayAccountId: store || undefined },
    { refetchOnMountOrArgChange: true, skip: !store }
  );

  const countFor = useCallback(
    (tabId: ReturnTab): number =>
      counts ? RETURN_TABS[tabId].reduce((sum, bucket) => sum + (counts[bucket] ?? 0), 0) : 0,
    [counts]
  );

  const tabItems = useMemo<TabNavItem[]>(
    () =>
      TAB_IDS.map((tabId) => ({
        id: tabId,
        label:
          tabId === ReturnTab.ALL
            ? t(`returns.tabs.${tabId}`)
            : t('returns.tabs.withCount', { label: t(`returns.tabs.${tabId}`), count: countFor(tabId) }),
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
    if (tab === ReturnTab.ALL && countFor(ReturnTab.ACTION) > 0) {
      setTab(ReturnTab.ACTION);
    }
  }, [counts, openedWithSelection, tab, countFor, setTab]);

  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  /* Money renders in the currency eBay reported on the return, else in the
     marketplace currency of the store it belongs to — never the UI language. */
  const rows = useMemo<ReturnRowView[]>(
    () =>
      (data?.items ?? []).map((item) =>
        toReturnRowView(item, {
          translate: (key, options) => t(key, options ?? {}),
          locale,
          currencyFor: (ebayAccountId) => resolveStoreCurrency(accounts, ebayAccountId),
          storeLabelFor: (ebayAccountId) => resolveRecordStoreLabel(accounts, ebayAccountId),
        })
      ),
    [data?.items, accounts, locale, t]
  );

  const columns = useReturnsColumns();

  const handleTabChange = useCallback((tabId: string) => setTab(isTab(tabId) ? tabId : ReturnTab.ALL), [setTab]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearchInput(e.target.value),
    [setSearchInput]
  );


  /* Every row opens — a return filed against an order we do not hold still
     has a history, a deadline and actions of its own. */
  const handleRowOpen = useCallback((row: ReturnRowView) => setSelected(row.id), [setSelected]);
  const handleCloseDetail = useCallback(() => setSelected(null), [setSelected]);

  const handleCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, row: ReturnRowView) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleRowOpen(row);
      }
    },
    [handleRowOpen]
  );

  return (
    <EbayAccountGuard>
      <ReturnsPageComponent
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
        subtitle={isLoading ? t('returns.loading') : t('returns.subtitle', { count: totalCount })}
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
        selectedReturnId={selected || null}
        onCloseDetail={handleCloseDetail}
      />
    </EbayAccountGuard>
  );
};
