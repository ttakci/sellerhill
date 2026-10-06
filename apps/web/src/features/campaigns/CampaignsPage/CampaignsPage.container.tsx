import { skipToken } from '@reduxjs/toolkit/query';
import { isValidLocale } from '@repo/shared';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetCampaignsQuery } from '../api/campaigns.api';

import { CampaignsPageComponent } from './CampaignsPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { buildLocalePath, resolveLocale } from '@/utils/locale';

export function CampaignsPageContainer() {
  const { activeStoreId } = useActiveStore();
  const { locale } = useParams();
  const navigate = useNavigate();
  const query = useGetCampaignsQuery(activeStoreId ? { ebayAccountId: activeStoreId } : skipToken);
  // `data` can retain the previous argument's result during a store switch.
  const campaigns = query.currentData?.campaigns ?? [];
  const errorKey =
    activeStoreId && query.error ? getErrorI18nKey(query.error, 'campaigns:campaigns.errors.description') : null;
  const onOpen = (campaignId: string) => {
    if (!activeStoreId) {return;}
    const path = buildLocalePath(
      `/campaigns/${encodeURIComponent(campaignId)}`,
      resolveLocale(locale && isValidLocale(locale) ? locale : null)
    );
    void navigate(`${path}?${new URLSearchParams({ store: activeStoreId }).toString()}`);
  };
  const onRetry = () => {
    if (activeStoreId) {void query.refetch();}
  };

  return (
    <EbayAccountGuard>
      <CampaignsPageComponent
        campaigns={campaigns}
        hasStore={activeStoreId !== null}
        isLoading={activeStoreId !== null && !query.currentData && !query.error}
        errorKey={errorKey}
        onRetry={onRetry}
        onOpen={onOpen}
      />
    </EbayAccountGuard>
  );
}
