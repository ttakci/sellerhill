import { skipToken } from '@reduxjs/toolkit/query';
import { isValidLocale } from '@repo/shared';
import { getLocaleConfig, type IconName, type TabNavItem, type ViewMode } from '@repo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetCampaignsQuery } from '../api/campaigns.api';

import {
  aggregateCampaignRoas,
  CAMPAIGN_METRICS,
  campaignTabOf,
  campaignViews,
  filterCampaigns,
  metricViews,
  sortCampaigns,
  sumCampaignMetric,
} from './CampaignList.helpers';
import { CampaignsPageComponent } from './CampaignsPage.component';
import { CampaignSortKey, CampaignTab, type CampaignSortDirection } from './CampaignsPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildLocalePath, resolveLocale } from '@/utils/locale';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

export function CampaignsPageContainer() {
  const { activeStoreId, stores } = useActiveStore();
  const { locale } = useParams();
  const { t, i18n } = useTranslation(['campaigns']);
  const navigate = useNavigate();
  const [scope, setScope] = useState(activeStoreId);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [drawerStoreId, setDrawerStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState<CampaignTab>(CampaignTab.ALL);
  const [search, setSearch] = useState('');
  // Biggest sellers first; a campaign with no figure yet sorts last either way.
  const [sortKey, setSortKey] = useState<CampaignSortKey>(CampaignSortKey.SALES);
  const [sortDirection, setSortDirection] = useState<CampaignSortDirection>('desc');
  if (scope !== activeStoreId) {
    setScope(activeStoreId);
    setDrawerStoreId(null);
    setViewMode('grid');
    setTab(CampaignTab.ALL);
    setSearch('');
  }
  const query = useGetCampaignsQuery(activeStoreId ? { ebayAccountId: activeStoreId } : skipToken);
  // Never show the previous argument's cached data during a store switch.
  const campaigns = query.currentData?.campaigns ?? [];
  const eligibility = query.currentData?.eligibility;
  const canCreate = eligibility?.status === 'ELIGIBLE';
  const eligibilityMessage =
    !activeStoreId || !query.currentData || canCreate
      ? null
      : eligibility?.status === 'INELIGIBLE'
        ? t('campaigns.eligibility.ineligible')
        : t('campaigns.eligibility.unavailable');
  const currency = resolveStoreCurrency(stores, activeStoreId);
  const numberLocale = getLocaleConfig(i18n.language).locale;
  const totals: Record<string, number> = {};
  for (const key of CAMPAIGN_METRICS) {
    const value = key === 'roas' ? aggregateCampaignRoas(campaigns) : sumCampaignMetric(campaigns, key);
    if (value !== null) {
      totals[key] = value;
    }
  }
  const tabCounts = new Map<CampaignTab, number>([[CampaignTab.ALL, campaigns.length]]);
  for (const campaign of campaigns) {
    const own = campaignTabOf(campaign.status);
    if (own) {
      tabCounts.set(own, (tabCounts.get(own) ?? 0) + 1);
    }
  }
  const tabLabels: Record<CampaignTab, string> = {
    [CampaignTab.ALL]: t('campaigns.list.tabs.all'),
    [CampaignTab.RUNNING]: t('campaigns.campaign.running'),
    [CampaignTab.PAUSED]: t('campaigns.campaign.paused'),
    [CampaignTab.ENDED]: t('campaigns.campaign.ended'),
  };
  const tabIcons: Record<CampaignTab, IconName> = {
    [CampaignTab.ALL]: 'format-list-bulleted',
    [CampaignTab.RUNNING]: 'play-arrow',
    [CampaignTab.PAUSED]: 'pause',
    [CampaignTab.ENDED]: 'block',
  };
  const tabItems: TabNavItem[] = Object.values(CampaignTab).map((id) => ({
    id,
    label: tabLabels[id],
    icon: tabIcons[id],
    count: tabCounts.get(id) ?? 0,
  }));
  const visible = sortCampaigns(filterCampaigns(campaigns, tab, search), sortKey, sortDirection);
  const sortLabels: Record<CampaignSortKey, string> = {
    [CampaignSortKey.SALES]: t('campaigns.list.metrics.sales'),
    [CampaignSortKey.AD_FEES]: t('campaigns.list.metrics.adFees'),
    [CampaignSortKey.ROAS]: t('campaigns.list.metrics.roas'),
    [CampaignSortKey.NAME]: t('campaigns.campaign.name'),
  };
  const sortOptions = Object.values(CampaignSortKey).flatMap((key) => [
    { value: `${key}:desc`, label: `${sortLabels[key]} ↓` },
    { value: `${key}:asc`, label: `${sortLabels[key]} ↑` },
  ]);
  const onSortChange = (value: string | number) => {
    const [key, direction] = String(value).split(':');
    const next = Object.values(CampaignSortKey).find((candidate) => (candidate as string) === key);
    if (next) {
      setSortKey(next);
      setSortDirection(direction === 'asc' ? 'asc' : 'desc');
    }
  };
  const onTabChange = (id: string) => {
    const next = Object.values(CampaignTab).find((candidate) => (candidate as string) === id);
    if (next) {
      setTab(next);
    }
  };
  const hasActiveFilters = tab !== CampaignTab.ALL || search.trim() !== '';
  const summaryMetrics = metricViews(totals, t, numberLocale, currency);
  const errorKey = activeStoreId && query.error ? getErrorI18nKey(query.error, 'campaigns.errors.description') : null;
  const onOpen = (campaignId: string) => {
    if (!activeStoreId) {
      return;
    }
    const path = buildLocalePath(
      `/campaigns/${encodeURIComponent(campaignId)}`,
      resolveLocale(locale && isValidLocale(locale) ? locale : null)
    );
    void navigate(`${path}?${new URLSearchParams({ store: activeStoreId }).toString()}`);
  };
  const onRetry = () => {
    if (activeStoreId) {
      void query.refetch();
    }
  };
  const onCreate = () => {
    if (activeStoreId && canCreate) {
      setDrawerStoreId(activeStoreId);
    }
  };

  return (
    <EbayAccountGuard>
      <CampaignsPageComponent
        campaigns={campaignViews(visible, t, numberLocale, currency)}
        metrics={summaryMetrics}
        metricsPending={summaryMetrics.some((metric) => !metric.known)}
        hasStore={activeStoreId !== null}
        isLoading={activeStoreId !== null && !query.currentData && !query.error}
        errorKey={errorKey}
        eligibilityMessage={eligibilityMessage}
        canCreate={canCreate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        tab={tab}
        tabItems={tabItems}
        onTabChange={onTabChange}
        search={search}
        onSearchChange={(event) => setSearch(event.target.value)}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => {
          setTab(CampaignTab.ALL);
          setSearch('');
        }}
        resultCount={visible.length}
        sortOptions={sortOptions}
        sortValue={`${sortKey}:${sortDirection}`}
        onSortChange={onSortChange}
        onRetry={onRetry}
        onOpen={onOpen}
        onCreate={onCreate}
        drawerStoreId={drawerStoreId === activeStoreId && canCreate ? drawerStoreId : null}
        onCloseDrawer={() => setDrawerStoreId(null)}
      />
    </EbayAccountGuard>
  );
}
