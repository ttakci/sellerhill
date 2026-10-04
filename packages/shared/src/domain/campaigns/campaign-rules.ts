import {
  CAMPAIGN_BID_MAX,
  CAMPAIGN_BID_MIN,
  CampaignReadOnlyReason,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
} from './campaigns.types';

/** True for a value eBay accepts as `bidPercentage`: 2.0–100.0, at most one decimal. */
export function isValidBidPercentage(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= CAMPAIGN_BID_MIN &&
    value <= CAMPAIGN_BID_MAX &&
    Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
  );
}

/**
 * The ad rate pricing must include for one listing (spec B5): its own fixed
 * rate while its campaign is a RUNNING cost-per-sale campaign with a fixed
 * strategy (an omitted strategy is eBay's default, FIXED); 0 otherwise.
 */
export function resolveAppliedAdRate(input: {
  rate: number | string | null;
  strategy: string | null;
  fundingModel: string | null;
  campaignStatus: string | null;
}): number {
  const strategy = input.strategy ?? EbayAdRateStrategy.FIXED;
  if (
    strategy !== (EbayAdRateStrategy.FIXED as string) ||
    input.fundingModel !== EbayCampaignFundingModel.COST_PER_SALE ||
    input.campaignStatus !== EbayCampaignStatus.RUNNING
  ) {
    return 0;
  }
  const rate = typeof input.rate === 'string' ? Number(input.rate) : input.rate;
  if (rate === null || !Number.isFinite(rate) || rate < CAMPAIGN_BID_MIN || rate > CAMPAIGN_BID_MAX) {
    return 0;
  }
  return Math.round(rate * 10) / 10;
}

/** Why SellerHill may not change a campaign, or null when it may. */
export function campaignReadOnlyReason(c: {
  status: string;
  fundingModel: string | null;
  adRateStrategy: string | null;
  ruleBased: boolean;
}): CampaignReadOnlyReason | null {
  if (c.status === (EbayCampaignStatus.ENDED as string)) {return CampaignReadOnlyReason.ENDED;}
  if (c.fundingModel !== EbayCampaignFundingModel.COST_PER_SALE) {return CampaignReadOnlyReason.COST_PER_CLICK;}
  if ((c.adRateStrategy ?? EbayAdRateStrategy.FIXED) !== (EbayAdRateStrategy.FIXED as string)) {return CampaignReadOnlyReason.DYNAMIC_RATE;}
  if (c.ruleBased) {return CampaignReadOnlyReason.RULE_BASED;}
  return null;
}
