/**
 * ActionCenterPage Container
 *
 * Owns the fetch, the severity filter and every i18n lookup that needs a
 * computed key (item copy is per-key, with `count` + `context` interpolation,
 * and breakdown chips resolve into other namespaces). The component receives
 * finished strings.
 */

import { ActionCenterSeverity, type ActionCenterGroupDto, type ActionCenterItemDto } from '@repo/shared';
import type { TabNavItem } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ACTION_CENTER_FILTER_ALL, breakdownLabelKey, filterToIcon } from '../actionCenterPresentation';
import { ACTION_CENTER_POLL_INTERVAL_MS, useGetActionCenterQuery } from '../api/actionCenterApi';

import { ActionCenterPage as ActionCenterPageComponent } from './ActionCenterPage.component';
import type { ActionCenterFilter, ActionCenterGroupView, ActionCenterItemView } from './ActionCenterPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const ActionCenterPageContainer: React.FC = () => {
  const { t } = useTranslation(['actionCenter', 'orders', 'listings', 'translation']);
  const { localeNavigate } = useLocale();
  const [filter, setFilter] = useState<ActionCenterFilter>(ACTION_CENTER_FILTER_ALL);

  const { data, isLoading } = useGetActionCenterQuery(undefined, {
    pollingInterval: ACTION_CENTER_POLL_INTERVAL_MS,
  });

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
   * the Dashboard section tabs use). Each carries its own count, so the rail
   * doubles as the summary strip — one control instead of a chip row and a
   * filter that repeat each other.
   */
  const filterOptions = useMemo<TabNavItem[]>(
    () => [
      {
        id: ACTION_CENTER_FILTER_ALL,
        label: `${t('actionCenter.filter.all')} · ${data?.totalCount ?? 0}`,
        icon: filterToIcon(ACTION_CENTER_FILTER_ALL),
      },
      {
        id: ActionCenterSeverity.CRITICAL,
        label: `${t('actionCenter.filter.critical')} · ${data?.criticalCount ?? 0}`,
        icon: filterToIcon(ActionCenterSeverity.CRITICAL),
      },
      {
        id: ActionCenterSeverity.WARNING,
        label: `${t('actionCenter.filter.warning')} · ${data?.warningCount ?? 0}`,
        icon: filterToIcon(ActionCenterSeverity.WARNING),
      },
      {
        id: ActionCenterSeverity.INFO,
        label: `${t('actionCenter.filter.info')} · ${data?.infoCount ?? 0}`,
        icon: filterToIcon(ActionCenterSeverity.INFO),
      },
    ],
    [t, data?.totalCount, data?.criticalCount, data?.warningCount, data?.infoCount],
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
      />
    </EbayAccountGuard>
  );
};

ActionCenterPageContainer.displayName = 'ActionCenterPageContainer';
