/**
 * ActionCenterPage Container
 *
 * Owns the fetch, the severity filter and every i18n lookup that needs a
 * computed key (item copy is per-key, with `count` + `context` interpolation,
 * and breakdown chips resolve into other namespaces). The component receives
 * finished strings.
 *
 * The page is STORE-SPECIFIC and the store is mandatory, like the Messages
 * inbox: `?store=` when it names a connected store, else the first store with
 * waiting work, else the first store — written back to the URL once the
 * counts are known. Every store's summary is fetched (`getActionCenterByStore`)
 * so each option of the picker carries that store's own count and a store
 * with waiting work is never hidden behind the selection. Account-wide items
 * (plan, setup, Amazon buyer accounts) appear in every store's view with a
 * caption saying so, and are left out of the per-store count.
 */

import {
  ActionCenterSeverity,
  type ActionCenterGroupDto,
  type ActionCenterItemDto,
} from '@repo/shared';
import type { SelectOption, TabNavItem } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { ACTION_CENTER_FILTER_ALL, breakdownLabelKey, filterToIcon } from '../actionCenterPresentation';
import { ACTION_CENTER_POLL_INTERVAL_MS, useGetActionCenterByStoreQuery } from '../api/actionCenterApi';
import { storeOwnItemCount } from '../utils/storeItemCount';

import { ActionCenterPage as ActionCenterPageComponent } from './ActionCenterPage.component';
import type { ActionCenterFilter, ActionCenterGroupView, ActionCenterItemView } from './ActionCenterPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { getStoreLabel } from '@/features/ebay/utils/storeLabel';
import { useLocale } from '@/utils/useLocale';

export const ActionCenterPageContainer: React.FC = () => {
  const { t } = useTranslation(['actionCenter', 'orders', 'listings', 'translation']);
  const { localeNavigate } = useLocale();
  const [filter, setFilter] = useState<ActionCenterFilter>(ACTION_CENTER_FILTER_ALL);

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedStore = searchParams.get('store') ?? '';

  const { data: accountsData, isLoading: isAccountsLoading } = useGetEbayAccountsQuery();
  const accounts = useMemo(() => accountsData?.items ?? [], [accountsData?.items]);
  const storeIds = useMemo(() => accounts.map((account) => account.id), [accounts]);

  const { data: byStore, isLoading: isSummaryLoading } = useGetActionCenterByStoreQuery(storeIds, {
    skip: storeIds.length === 0,
    pollingInterval: ACTION_CENTER_POLL_INTERVAL_MS,
  });

  const storeItemCount = storeOwnItemCount;

  const selectedStore = useMemo(() => {
    if (storeIds.includes(requestedStore)) {
      return requestedStore;
    }
    const withWork = storeIds.find((id) => storeItemCount(byStore?.[id]) > 0);
    return withWork ?? storeIds[0] ?? '';
  }, [byStore, requestedStore, storeIds, storeItemCount]);

  /*
   * Write the resolved default into the URL — once the counts are in, so the
   * "first store with waiting work" rule has something to read. After that the
   * URL names a valid store and the choice sticks across polls.
   */
  useEffect(() => {
    if (!byStore || !selectedStore || selectedStore === requestedStore) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('store', selectedStore);
    setSearchParams(next, { replace: true });
  }, [byStore, requestedStore, searchParams, selectedStore, setSearchParams]);

  const handleStoreChange = useCallback(
    (value: string | number) => {
      const next = new URLSearchParams(searchParams);
      next.set('store', String(value));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const storeOptions = useMemo<SelectOption[]>(
    () =>
      accounts.map((account) => {
        const label = getStoreLabel(account);
        const count = storeItemCount(byStore?.[account.id]);
        return {
          value: account.id,
          label: count > 0 ? t('actionCenter.storeFilter.optionWithCount', { store: label, count }) : label,
        };
      }),
    [accounts, byStore, storeItemCount, t],
  );

  const data = selectedStore ? byStore?.[selectedStore] : undefined;
  const isLoading = isAccountsLoading || isSummaryLoading;

  /**
   * Resolve one item's copy.
   *
   * `count` goes into every lookup so i18next picks the right plural form, and
   * `context` supplies the numeric placeholders (`{{used}}`, `{{days}}`) the
   * backend measured.
   */
  const toItemView = useCallback(
    (item: ActionCenterItemDto): ActionCenterItemView => {
      const interpolation = { count: item.count, ...(item.context ?? {}) };
      const chips = (item.breakdown ?? []).flatMap((entry) => {
        const key = breakdownLabelKey(item.key, entry.code);
        // An unmapped code would render as a raw enum value — exactly the
        // internal-jargon leak the failure taxonomy exists to prevent. Drop the
        // chip instead; the count above it still tells the true story.
        return key ? [{ code: entry.code, count: entry.count, label: t(key) }] : [];
      });

      return {
        ...item,
        title: t(`actionCenter.items.${item.key}.title`, interpolation),
        description: t(`actionCenter.items.${item.key}.description`, interpolation),
        actionLabel: t(`actionCenter.items.${item.key}.action`),
        chips,
        storeLabels: (item.stores ?? []).map((store) => store.label),
        accountWideNote: item.accountWide ? t('actionCenter.storeFilter.accountWide') : null,
      };
    },
    [t],
  );

  const toGroupView = useCallback(
    (group: ActionCenterGroupDto): ActionCenterGroupView => ({
      ...group,
      title: t(`actionCenter.groups.${group.key}.title`),
      subtitle: t(`actionCenter.groups.${group.key}.subtitle`),
      items: group.items.map(toItemView),
    }),
    [t, toItemView],
  );

  /**
   * Filtering happens client-side: the payload is a handful of rows, and a
   * round-trip per filter click would make the control feel broken. A group
   * that loses all of its items to the filter is dropped, so the filtered view
   * never shows an empty heading — the same rule the backend assembly applies.
   */
  const groups = useMemo<ActionCenterGroupView[]>(() => {
    const source = data?.groups ?? [];
    return source
      .map((group) =>
        filter === ACTION_CENTER_FILTER_ALL
          ? group
          : { ...group, items: group.items.filter((item) => item.severity === filter) },
      )
      .filter((group) => group.items.length > 0)
      .map(toGroupView);
  }, [data?.groups, filter, toGroupView]);

  /**
   * Tab items for the shared `TabNav` rail (`underline` variant — the same rail
   * the Dashboard section tabs use). Labels are the severity name only — the
   * per-tab counts were dropped on request; each item card already carries its
   * own count, and the sidebar badge carries the total.
   */
  const filterOptions = useMemo<TabNavItem[]>(
    () => [
      {
        id: ACTION_CENTER_FILTER_ALL,
        label: t('actionCenter.filter.all'),
        icon: filterToIcon(ACTION_CENTER_FILTER_ALL),
      },
      {
        id: ActionCenterSeverity.CRITICAL,
        label: t('actionCenter.filter.critical'),
        icon: filterToIcon(ActionCenterSeverity.CRITICAL),
      },
      {
        id: ActionCenterSeverity.WARNING,
        label: t('actionCenter.filter.warning'),
        icon: filterToIcon(ActionCenterSeverity.WARNING),
      },
      {
        id: ActionCenterSeverity.INFO,
        label: t('actionCenter.filter.info'),
        icon: filterToIcon(ActionCenterSeverity.INFO),
      },
    ],
    [t],
  );

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as ActionCenterFilter);
  }, []);

  const handleItemAction = useCallback(
    (item: ActionCenterItemView) => {
      if (item.actionPath) {
        localeNavigate(item.actionPath);
      }
    },
    [localeNavigate],
  );

  return (
    <EbayAccountGuard>
      <ActionCenterPageComponent
        groups={groups}
        filter={filter}
        onFilterChange={handleFilterChange}
        filterOptions={filterOptions}
        isInitialLoading={isLoading && !data}
        isEmpty={!isLoading && (data?.totalCount ?? 0) === 0}
        onItemAction={handleItemAction}
        selectedStore={selectedStore}
        storeOptions={storeOptions}
        onStoreChange={handleStoreChange}
      />
    </EbayAccountGuard>
  );
};

ActionCenterPageContainer.displayName = 'ActionCenterPageContainer';
