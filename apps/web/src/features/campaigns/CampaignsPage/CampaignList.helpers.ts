import { EbayAdRateStrategy, EbayCampaignFundingModel, EbayCampaignStatus, type EbayCampaignDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import {
  CampaignSortKey,
  CampaignTab,
  type CampaignSortDirection,
  type CampaignView,
  type MetricView,
} from './CampaignsPage.types';

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

/** An unknown figure is an em dash, never a zero and never a sentence in a figure's slot. */
export const METRIC_UNKNOWN = '—';

export function metricViews(
  metrics: Record<string, number> | null,
  t: TFunction,
  locale: string,
  currency: string
): MetricView[] {
  return CAMPAIGN_METRICS.map((key) => {
    const value = formatCampaignMetric(
      metrics,
      key === 'sales' || key === 'adFees' ? 'currency' : key === 'roas' ? 'ratio' : 'number',
      key,
      locale,
      currency,
      METRIC_UNKNOWN
    );
    return { key, label: t(`campaigns.list.metrics.${key}`), value, known: value !== METRIC_UNKNOWN };
  });
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
          : campaign.status === (EbayCampaignStatus.ENDED as string)
            ? 'navy'
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
    ...cardMetrics(metricViews(campaign.metrics, t, locale, currency)),
  }));
}

function cardMetrics(all: MetricView[]): Pick<CampaignView, 'roas' | 'stats'> {
  const byKey = new Map(all.map((metric) => [metric.key, metric]));
  return {
    roas: byKey.get('roas') as MetricView,
    stats: ['sales', 'adFees', 'clicks'].map((key) => byKey.get(key) as MetricView),
  };
}

/** The tab a campaign is listed under besides All; null = an eBay status with no tab of its own. */
export function campaignTabOf(status: string | null | undefined): CampaignTab | null {
  if (status === (EbayCampaignStatus.RUNNING as string)) {
    return CampaignTab.RUNNING;
  }
  if (status === (EbayCampaignStatus.PAUSED as string)) {
    return CampaignTab.PAUSED;
  }
  if (status === (EbayCampaignStatus.ENDED as string)) {
    return CampaignTab.ENDED;
  }
  return null;
}

/** Campaigns on a tab whose name or id contains the search text (case-insensitive). */
export function filterCampaigns<T extends Pick<EbayCampaignDto, 'status' | 'name' | 'campaignId'>>(
  campaigns: T[],
  tab: CampaignTab,
  search: string
): T[] {
  const needle = search.trim().toLocaleLowerCase();
  return campaigns.filter(
    (campaign) =>
      (tab === CampaignTab.ALL || campaignTabOf(campaign.status) === tab) &&
      (!needle ||
        campaign.name.toLocaleLowerCase().includes(needle) ||
        campaign.campaignId.toLocaleLowerCase().includes(needle))
  );
}

function sortValueOf(campaign: Pick<EbayCampaignDto, 'metrics'>, key: CampaignSortKey): number | null {
  if (key === CampaignSortKey.ROAS) {
    return aggregateCampaignRoas([campaign]);
  }
  const value = campaign.metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A copy of the list in the chosen order. A campaign eBay reported no figure
 * for sorts LAST in both directions (an unknown is not a zero), and ties keep
 * the order the API gave.
 */
export function sortCampaigns<T extends Pick<EbayCampaignDto, 'name' | 'metrics'>>(
  campaigns: T[],
  key: CampaignSortKey,
  direction: CampaignSortDirection
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return campaigns
    .map((campaign, index) => ({ campaign, index }))
    .sort((a, b) => {
      if (key === CampaignSortKey.NAME) {
        return sign * a.campaign.name.localeCompare(b.campaign.name) || a.index - b.index;
      }
      const left = sortValueOf(a.campaign, key);
      const right = sortValueOf(b.campaign, key);
      if (left === null || right === null) {
        return left === right ? a.index - b.index : left === null ? 1 : -1;
      }
      return sign * (left - right) || a.index - b.index;
    })
    .map(({ campaign }) => campaign);
}
