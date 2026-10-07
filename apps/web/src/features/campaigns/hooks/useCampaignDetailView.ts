import { CampaignAction, EbayCampaignStatus, type CampaignListingDto, type EbayCampaignDetailDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import { memberRateLabel } from '../CampaignDetailPage/CampaignMembers.helpers';
import { campaignViews, formatCampaignMetric, metricViews } from '../CampaignsPage/CampaignList.helpers';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { resolveStoreCurrency } from '@/utils/resolveStoreCurrency';

export function useCampaignDetailView(
  detail: EbayCampaignDetailDto | undefined,
  selected: CampaignListingDto[],
  writable: boolean
) {
  const { activeStoreId, stores } = useActiveStore();
  const { t, i18n } = useTranslation(['campaigns']);
  const numberLocale = getLocaleConfig(i18n.language).locale;
  const currency = resolveStoreCurrency(stores, activeStoreId);
  const unavailable = t('campaigns.list.metrics.unavailable');
  const campaignView = detail ? campaignViews([detail.campaign], t, numberLocale, currency)[0] : undefined;
  const number = new Intl.NumberFormat(numberLocale);
  const start = detail?.campaign.startDate ? new Date(detail.campaign.startDate) : null;
  const facts =
    campaignView && detail
      ? [
          { label: t('campaigns.campaign.status'), value: campaignView.status },
          { label: t('campaigns.campaign.strategy'), value: campaignView.strategy },
          { label: t('campaigns.campaign.rateType'), value: campaignView.rateType },
          { label: t('campaigns.campaign.defaultRate'), value: campaignView.defaultRate },
          {
            label: t('campaigns.campaign.startDate'),
            value:
              start && Number.isFinite(start.getTime())
                ? new Intl.DateTimeFormat(numberLocale).format(start)
                : unavailable,
          },
          {
            label: t('campaigns.campaign.adCount'),
            value:
              detail.campaign.adCount !== null && Number.isFinite(detail.campaign.adCount)
                ? number.format(detail.campaign.adCount)
                : unavailable,
          },
        ]
      : [];
  // Preserve unconfirmed/failed members even if a refetch temporarily omits them.
  const merged = new Map((detail?.listings ?? []).map((member) => [member.listingId, member]));
  for (const member of selected) {
    if (!merged.has(member.listingId)) {
      merged.set(member.listingId, member);
    }
  }
  const members = [...merged.values()].map((member) => ({
    ...member,
    priceText: formatCampaignMetric(
      member.price === null ? null : { price: member.price },
      'currency',
      'price',
      numberLocale,
      currency,
      unavailable
    ),
    rateText:
      member.adRate !== null && Number.isFinite(member.adRate) ? `${number.format(member.adRate)}%` : unavailable,
    note:
      memberRateLabel(member) === 'not-applied'
        ? t('campaigns.readOnly.marginOverride')
        : memberRateLabel(member) === 'price-locked'
          ? t('campaigns.members.priceLocked')
          : null,
  }));
  const writeReason =
    !detail || writable
      ? null
      : detail.eligibility.status === 'INELIGIBLE'
        ? t('campaigns.eligibility.ineligible')
        : detail.eligibility.status !== 'ELIGIBLE'
          ? t('campaigns.detail.eligibilityUnavailable')
          : detail.campaign.readOnlyReason
            ? t(`campaigns.readOnly.${detail.campaign.readOnlyReason}`)
            : t('campaigns.readOnly.unsupported');
  return {
    facts,
    campaignView,
    members,
    writeReason,
    metrics: metricViews(detail?.campaign.metrics ?? null, t, numberLocale, currency),
    selectedRows: members.filter((member) => selected.some((row) => row.listingId === member.listingId)),
    lifecycleAction:
      detail?.campaign.status === (EbayCampaignStatus.RUNNING as string)
        ? CampaignAction.PAUSE
        : detail?.campaign.status === (EbayCampaignStatus.PAUSED as string)
          ? CampaignAction.RESUME
          : null,
  };
}
