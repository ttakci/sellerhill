export enum EbayCampaignStatus {
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED',
}

export enum EbayCampaignFundingModel {
  COST_PER_SALE = 'COST_PER_SALE',
  COST_PER_CLICK = 'COST_PER_CLICK',
}

export enum EbayAdRateStrategy {
  FIXED = 'FIXED',
  DYNAMIC = 'DYNAMIC',
}

export enum CampaignReadOnlyReason {
  RULE_BASED = 'rule_based',
  COST_PER_CLICK = 'cost_per_click',
  DYNAMIC_RATE = 'dynamic_rate',
  ENDED = 'ended',
}

export enum CampaignAction {
  PAUSE = 'pause',
  RESUME = 'resume',
  END = 'end',
}

export enum CampaignAddOutcome {
  ADDED = 'added',
  ALREADY_IN_CAMPAIGN = 'already_in_campaign',
  FAILED = 'failed',
}

export const CAMPAIGN_BID_MIN = 2;
export const CAMPAIGN_BID_MAX = 100;
export const CAMPAIGN_NAME_MAX_LENGTH = 80;

export interface EbayCampaignDto {
  id: string;
  ebayAccountId: string;
  campaignId: string;
  name: string;
  status: string;
  fundingModel: string | null;
  adRateStrategy: string | null;
  bidPercentage: number | null;
  ruleBased: boolean;
  createdBySellerHill: boolean;
  startDate: string | null;
  endDate: string | null;
  adCount: number | null;
  sellerHillListingCount: number;
  readOnlyReason: CampaignReadOnlyReason | null;
  syncedAt: string;
  metrics: Record<string, number> | null;
  metricsFrom: string | null;
  metricsTo: string | null;
}

export interface CampaignListingDto {
  listingId: string;
  ebayItemId: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  adRate: number | null;
  appliedAdRate: number;
  priceLocked: boolean;
}

export interface EbayCampaignDetailDto {
  campaign: EbayCampaignDto;
  listings: CampaignListingDto[];
  eligibility: { status: string | null; reason: string | null };
}

export interface CampaignCandidatesQuery {
  ebayAccountId: string;
  listingSettingsGroupId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCampaignRequest {
  ebayAccountId: string;
  name: string;
  bidPercentage: number;
}

export interface CampaignListingsRequest {
  ebayAccountId: string;
  listingIds: string[];
}

export interface CampaignRateRequest {
  ebayAccountId: string;
  bidPercentage: number;
  listingIds?: string[];
}

export interface CampaignWriteResultDto {
  campaignId: string;
  results: Array<{ listingId: string; outcome: CampaignAddOutcome }>;
}
