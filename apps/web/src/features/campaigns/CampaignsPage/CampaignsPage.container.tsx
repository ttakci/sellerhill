import { useTheme } from '@emotion/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { isValidLocale } from '@repo/shared';
import { getLocaleConfig, type AppTheme, type ViewMode } from '@repo/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetCampaignsQuery } from '../api/campaigns.api';

import {
  aggregateCampaignRoas,
  CAMPAIGN_METRICS,
  campaignViews,
  metricViews,
  sumCampaignMetric,
} from './CampaignList.helpers';
import { CampaignsPageComponent } from './CampaignsPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildLocalePath, resolveLocale } from '@/utils/locale';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

export function CampaignsPageContainer() {
  const theme = useTheme() as AppTheme;
  const { activeStoreId, stores } = useActiveStore();
  const { locale } = useParams();
  const { t, i18n } = useTranslation(['campaigns']);
  const navigate = useNavigate();
  const [scope, setScope] = useState(activeStoreId);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [drawerStoreId, setDrawerStoreId] = useState<string | null>(null);
  if (scope !== activeStoreId) {
    setScope(activeStoreId);
    setDrawerStoreId(null);
    setViewMode('grid');
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
        campaigns={campaignViews(campaigns, t, numberLocale, currency)}
        metrics={metricViews(totals, t, numberLocale, currency)}
        hasStore={activeStoreId !== null}
        isLoading={activeStoreId !== null && !query.currentData && !query.error}
        errorKey={errorKey}
        eligibilityMessage={eligibilityMessage}
        canCreate={canCreate}
        viewMode={viewMode}
        gridMinItemWidth={`calc(${theme.spacing.xxxl} * 5)`}
        onViewModeChange={setViewMode}
        onRetry={onRetry}
        onOpen={onOpen}
        onCreate={onCreate}
        drawerStoreId={drawerStoreId === activeStoreId && canCreate ? drawerStoreId : null}
        onCloseDrawer={() => setDrawerStoreId(null)}
      />
    </EbayAccountGuard>
  );
}
