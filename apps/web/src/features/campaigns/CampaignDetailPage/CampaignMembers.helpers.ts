import {
  CampaignAddOutcome,
  EbayAdRateStrategy,
  EbayCampaignFundingModel,
  EbayCampaignStatus,
  type CampaignListingDto,
  type EbayCampaignDto,
  type CampaignWriteResultDto,
} from '@repo/shared';

export function memberRateLabel(member: Pick<CampaignListingDto, 'hasMarginOverride' | 'priceLocked'>) {
  return member.hasMarginOverride ? 'not-applied' : member.priceLocked ? 'price-locked' : null;
}

export function canWriteCampaign(
  campaign: Pick<EbayCampaignDto, 'readOnlyReason' | 'ruleBased' | 'status' | 'fundingModel' | 'adRateStrategy'>,
  eligibility: string | null
) {
  return (
    eligibility === 'ELIGIBLE' &&
    campaign.readOnlyReason === null &&
    !campaign.ruleBased &&
    campaign.fundingModel === EbayCampaignFundingModel.COST_PER_SALE &&
    campaign.adRateStrategy === EbayAdRateStrategy.FIXED &&
    (campaign.status === (EbayCampaignStatus.RUNNING as string) ||
      campaign.status === (EbayCampaignStatus.PAUSED as string))
  );
}

export function writeOutcome(ids: string[], response: Pick<CampaignWriteResultDto, 'results'> | undefined) {
  const unique = [...new Set(ids)];
  const changed: string[] = [];
  const already: string[] = [];
  const failed: string[] = [];
  for (const id of unique) {
    const results = response?.results?.filter((row) => row.listingId === id) ?? [];
    if (results.length === 1 && results[0].outcome === CampaignAddOutcome.ADDED) {
      changed.push(id);
    } else if (results.length === 1 && results[0].outcome === CampaignAddOutcome.ALREADY_IN_CAMPAIGN) {
      already.push(id);
    } else {
      failed.push(id);
    }
  }
  return { changed, already, failed, unconfirmed: !unique.length || !response?.results?.length };
}

export function campaignErrorKey(failure: unknown) {
  const data = typeof failure === 'object' && failure !== null && 'data' in failure ? failure.data : null;
  const message = typeof data === 'object' && data !== null && 'message' in data ? data.message : null;
  const suffixes = [
    'storeUnavailable',
    'suspended',
    'notFound',
    'ineligible',
    'readOnly',
    'invalidRate',
    'ebayRejected',
  ];
  return typeof message === 'string' && suffixes.some((suffix) => message === `campaigns.errors.${suffix}`)
    ? message
    : 'campaigns.errors.ebayRejected';
}
