import { skipToken } from '@reduxjs/toolkit/query';
import { isValidLocale } from '@repo/shared';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetCampaignQuery } from '../api/campaigns.api';

import { CampaignDetailPageComponent } from './CampaignDetailPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildLocalePath, resolveLocale } from '@/utils/locale';

export function CampaignDetailPageContainer() {
  const { activeStoreId } = useActiveStore();
  const { campaignId, locale } = useParams();
  const navigate = useNavigate();
  const query = useGetCampaignQuery(
    activeStoreId && campaignId ? { ebayAccountId: activeStoreId, campaignId } : skipToken
  );
  const detail = activeStoreId ? query.currentData : undefined;
  const errorKey =
    activeStoreId && query.error ? getErrorI18nKey(query.error, 'campaigns:campaigns.errors.description') : null;
  const onRetry = () => {
    if (activeStoreId && campaignId) {void query.refetch();}
  };
  const onBack = () => {
    const search = activeStoreId ? `?${new URLSearchParams({ store: activeStoreId }).toString()}` : '';
    void navigate(
      `${buildLocalePath('/campaigns', resolveLocale(locale && isValidLocale(locale) ? locale : null))}${search}`
    );
  };

  return (
    <EbayAccountGuard>
      <CampaignDetailPageComponent
        detail={detail}
        hasStore={activeStoreId !== null}
        isLoading={activeStoreId !== null && !query.currentData && !query.error}
        errorKey={errorKey}
        onRetry={onRetry}
        onBack={onBack}
      />
    </EbayAccountGuard>
  );
}
