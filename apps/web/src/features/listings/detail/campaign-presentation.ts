import { resolveAppliedAdRate, type ListingDto } from '@repo/shared';

export type ListingCampaignNote = 'margin-override' | 'not-followed' | null;

export interface ListingCampaignPresentation {
  campaignId: string;
  name: string;
  /** The synced eBay campaign rate; null for a dynamic-rate campaign. */
  rate: number | null;
  /** Why SellerHill's price does not include `rate`, or null when it does. */
  note: ListingCampaignNote;
}

/**
 * The listing detail "Ad campaign" row (spec B7). A margin override is read
 * from the override fields themselves — never from `appliedAdRate`, which a
 * synced dynamic campaign can leave nonzero.
 */
export function listingCampaignPresentation(
  listing: Pick<ListingDto, 'adCampaign' | 'marginPercentOverride' | 'marginFixedOverride'>
): ListingCampaignPresentation | null {
  const campaign = listing.adCampaign;
  if (!campaign) {
    return null;
  }
  const hasMarginOverride = (listing.marginPercentOverride ?? null) !== null || (listing.marginFixedOverride ?? null) !== null;
  const followed =
    resolveAppliedAdRate({
      rate: campaign.adRate,
      strategy: campaign.adRateStrategy,
      fundingModel: campaign.fundingModel,
      campaignStatus: campaign.status,
    }) > 0;
  return {
    campaignId: campaign.campaignId,
    name: campaign.name,
    rate: campaign.adRate,
    note: hasMarginOverride ? 'margin-override' : followed ? null : 'not-followed',
  };
}
