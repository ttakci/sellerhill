import { EbayAdRateStrategy, EbayCampaignFundingModel, EbayCampaignStatus, type EbayCampaignDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import type { CampaignView, MetricView } from './CampaignsPage.types';

type MetricSource = { metrics: Record<string, number> | null };
export const CAMPAIGN_METRICS = ['clicks', 'impressions', 'sales', 'adFees', 'roas', 'quantitySold'] as const;

export function formatCampaignMetric(
  metrics: Record<string, number> | null,
  kind: 'currency' | 'number' | 'ratio',
  key = 'sales',
  locale = 'en-US',
  currency = 'USD',
  unavailable = '—'
): string {
  const value = metrics?.[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return unavailable;
  }
  if (kind === 'ratio') {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}×`;
  }
  return new Intl.NumberFormat(
    locale,
    kind === 'currency' ? { style: 'currency', currency } : { maximumFractionDigits: 0 }
  ).format(value);
}

export function sumCampaignMetric(campaigns: MetricSource[], key: string): number | null {
  if (!campaigns.length) {
    return null;
  }
  let total = 0;
  for (const campaign of campaigns) {
    const value = campaign.metrics?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    total += value;
  }
  return Number.isFinite(total) ? total : null;
}

export function aggregateCampaignRoas(campaigns: MetricSource[]): number | null {
  const sales = sumCampaignMetric(campaigns, 'sales');
  const fees = sumCampaignMetric(campaigns, 'adFees');
  return sales !== null && fees !== null && fees > 0 ? sales / fees : null;
}

export function metricViews(
  metrics: Record<string, number> | null,
  t: TFunction,
  locale: string,
  currency: string
): MetricView[] {
  return CAMPAIGN_METRICS.map((key) => ({
    key,
    label: t(`campaigns.list.metrics.${key}`),
    value: formatCampaignMetric(
      metrics,
      key === 'sales' || key === 'adFees' ? 'currency' : key === 'roas' ? 'ratio' : 'number',
      key,
      locale,
      currency,
      t('campaigns.list.metrics.unavailable')
    ),
  }));
}

export function campaignViews(
  campaigns: EbayCampaignDto[],
  t: TFunction,
  locale: string,
  currency: string
): CampaignView[] {
  const unavailable = t('campaigns.list.metrics.unavailable');
  const number = new Intl.NumberFormat(locale);
  return campaigns.map((campaign) => ({
    campaignId: campaign.campaignId,
    name: campaign.name,
    status:
      campaign.status === (EbayCampaignStatus.RUNNING as string)
        ? t('campaigns.campaign.running')
        : campaign.status === (EbayCampaignStatus.PAUSED as string)
          ? t('campaigns.campaign.paused')
          : campaign.status === (EbayCampaignStatus.ENDED as string)
            ? t('campaigns.campaign.ended')
            : campaign.status || unavailable,
    statusTone:
      campaign.status === (EbayCampaignStatus.RUNNING as string)
        ? 'success'
        : campaign.status === (EbayCampaignStatus.PAUSED as string)
          ? 'warning'
          : 'neutral',
    strategy: campaign.ruleBased
      ? t('campaigns.campaign.ruleBased')
      : campaign.adRateStrategy === (EbayAdRateStrategy.DYNAMIC as string)
        ? t('campaigns.campaign.dynamic')
        : // eBay omits the strategy for its FIXED default (resolveAppliedAdRate treats null as FIXED).
          t('campaigns.campaign.fixed'),
    rateType:
      campaign.fundingModel === EbayCampaignFundingModel.COST_PER_SALE
        ? t('campaigns.campaign.costPerSale')
        : campaign.fundingModel === EbayCampaignFundingModel.COST_PER_CLICK
          ? t('campaigns.campaign.costPerClick')
          : unavailable,
    defaultRate:
      campaign.bidPercentage === null || !Number.isFinite(campaign.bidPercentage)
        ? unavailable
        : `${number.format(campaign.bidPercentage)}%`,
    listingCount: `${number.format(campaign.sellerHillListingCount)} / ${
      campaign.adCount === null || !Number.isFinite(campaign.adCount) ? unavailable : number.format(campaign.adCount)
    }`,
    outsideSellerHill: !campaign.createdBySellerHill,
    readOnly: campaign.readOnlyReason !== null,
    metrics: metricViews(campaign.metrics, t, locale, currency).filter(
      ({ key }) => key === 'sales' || key === 'adFees' || key === 'roas'
    ),
  }));
}
