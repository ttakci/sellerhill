import { skipToken } from '@reduxjs/toolkit/query';
import { isValidLocale, type CampaignListingDto } from '@repo/shared';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useGetCampaignQuery } from '../api/campaigns.api';
import { useCampaignDetailActions } from '../hooks/useCampaignDetailActions';
import { useCampaignDetailView } from '../hooks/useCampaignDetailView';

import { CampaignDetailPageComponent } from './CampaignDetailPage.component';
import type { CampaignDetailPageProps } from './CampaignDetailPage.types';
import { canWriteCampaign } from './CampaignMembers.helpers';

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
  const writable = Boolean(detail && canWriteCampaign(detail.campaign, detail.eligibility.status));
  const actions = useCampaignDetailActions(activeStoreId, campaignId, detail, writable);
  const context = `${activeStoreId}:${campaignId}`;
  const [drawers, setDrawers] = useState({
    context,
    addOpen: false,
    rateTarget: null as CampaignDetailPageProps['rateTarget'],
  });
  if (drawers.context !== context) {
    setDrawers({ context, addOpen: false, rateTarget: null });
  }
  const view = useCampaignDetailView(detail, actions.selected, writable);
  const onBack = () => {
    const search = activeStoreId ? `?${new URLSearchParams({ store: activeStoreId }).toString()}` : '';
    void navigate(
      `${buildLocalePath('/campaigns', resolveLocale(locale && isValidLocale(locale) ? locale : null))}${search}`
    );
  };
  const onRateOpen = (member?: CampaignListingDto) => {
    if (writable && detail) {
      setDrawers({
        context,
        addOpen: false,
        rateTarget: {
          listingId: member?.listingId,
          initialRate: member ? member.adRate : detail.campaign.bidPercentage,
          members: member ? [member] : detail.listings,
        },
      });
    }
  };
  return (
    <EbayAccountGuard>
      <CampaignDetailPageComponent
        detail={detail}
        hasStore={activeStoreId !== null}
        isLoading={activeStoreId !== null && !query.currentData && !query.error}
        errorKey={activeStoreId && query.error ? getErrorI18nKey(query.error, 'campaigns.errors.description') : null}
        onRetry={() => {
          if (activeStoreId && campaignId) {
            void query.refetch();
          }
        }}
        onBack={onBack}
        {...view}
        writable={writable}
        busy={actions.busy}
        feedback={actions.feedback}
        storeId={activeStoreId}
        campaignId={campaignId}
        addOpen={drawers.context === context && drawers.addOpen && writable}
        rateTarget={drawers.context === context && writable ? drawers.rateTarget : null}
        endOpen={actions.endOpen && writable}
        onSelect={actions.onSelect}
        onRemove={actions.onRemove}
        onAddOpen={() => {
          if (writable) {
            setDrawers({ context, addOpen: true, rateTarget: null });
          }
        }}
        onAddClose={() => setDrawers({ context, addOpen: false, rateTarget: null })}
        onRateOpen={onRateOpen}
        onRateClose={() => setDrawers({ context, addOpen: false, rateTarget: null })}
        onAction={actions.onAction}
        onEndOpen={actions.onEndOpen}
        onEndClose={actions.onEndClose}
      />
    </EbayAccountGuard>
  );
}
