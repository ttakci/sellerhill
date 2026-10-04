import { readEbayErrorIds } from '../ebay/ebay-promoted.helpers';

export interface ParsedCampaign {
  campaignId: string;
  name: string;
  status: string;
  fundingModel: string | null;
  adRateStrategy: string | null;
  bidPercentage: number | null;
  /** A rule-based campaign carries a `campaignCriterion`; it is read, never edited here. */
  ruleBased: boolean;
  startDate: string | null;
  endDate: string | null;
}

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function pageTotal(value: unknown): number | null {
  const total = num(value);
  return total !== null && Number.isSafeInteger(total) && total >= 0 ? total : null;
}

function optionalBid(source: Obj): number | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, 'bidPercentage')) {
    return null;
  }
  return num(source.bidPercentage) ?? undefined;
}

export function readCampaignsPage(body: unknown): { campaigns: ParsedCampaign[]; total: number | null } | null {
  if (!isObj(body) || !Array.isArray(body.campaigns)) {
    return null;
  }
  const total = pageTotal(body.total);
  if (total === null) {
    return null;
  }
  const campaigns: ParsedCampaign[] = [];
  for (const raw of body.campaigns) {
    if (!isObj(raw)) {
      return null;
    }
    const campaignId = str(raw.campaignId);
    const name = str(raw.campaignName);
    const status = str(raw.campaignStatus);
    const funding = raw.fundingStrategy;
    if (!campaignId || !name || !status || !isObj(funding) || !str(funding.fundingModel)) {
      return null;
    }
    if (
      (raw.campaignCriterion !== undefined && raw.campaignCriterion !== null && !isObj(raw.campaignCriterion)) ||
      (funding.adRateStrategy !== undefined && funding.adRateStrategy !== null && !str(funding.adRateStrategy))
    ) {
      return null;
    }
    const bidPercentage = optionalBid(funding);
    if (bidPercentage === undefined) {
      return null;
    }
    const ruleBased = isObj(raw.campaignCriterion);
    if (
      status === 'RUNNING' && funding.fundingModel === 'COST_PER_SALE' &&
      (str(funding.adRateStrategy) ?? 'FIXED') === 'FIXED' &&
      !ruleBased && bidPercentage === null
    ) {
      return null;
    }
    campaigns.push({
      campaignId,
      name,
      status,
      fundingModel: str(funding.fundingModel),
      adRateStrategy: str(funding.adRateStrategy),
      bidPercentage,
      ruleBased,
      startDate: str(raw.startDate),
      endDate: str(raw.endDate),
    });
  }
  return campaigns.length <= total ? { campaigns, total } : null;
}

export function readAdsPage(
  body: unknown
): { ads: Array<{ listingId: string; bidPercentage: number | null }>; total: number | null } | null {
  if (!isObj(body) || !Array.isArray(body.ads)) {
    return null;
  }
  const total = pageTotal(body.total);
  if (total === null) {
    return null;
  }
  const ads: Array<{ listingId: string; bidPercentage: number | null }> = [];
  for (const raw of body.ads) {
    if (!isObj(raw)) {
      return null;
    }
    const listingId = str(raw.listingId);
    const bidPercentage = optionalBid(raw);
    if (!listingId || bidPercentage === undefined) {
      return null;
    }
    ads.push({ listingId, bidPercentage });
  }
  return ads.length <= total ? { ads, total } : null;
}

export function readBulkListingResponse(
  body: unknown,
  requested: readonly string[]
): Array<{ listingId: string; ok: boolean; errorIds: number[] }> {
  const answered = new Map<string, { ok: boolean; errorIds: number[] }>();
  const responses = isObj(body) && Array.isArray(body.responses) ? body.responses : [];
  for (const raw of responses) {
    if (!isObj(raw)) {
      continue;
    }
    const listingId = str(raw.listingId);
    if (!listingId) {
      continue;
    }
    const status = num(raw.statusCode);
    const errors = Array.isArray(raw.errors) ? raw.errors : [];
    answered.set(listingId, {
      ok: status !== null && status >= 200 && status < 300 && errors.length === 0,
      errorIds: readEbayErrorIds({ errors }),
    });
  }
  return requested.map((listingId) => ({ listingId, ...(answered.get(listingId) ?? { ok: false, errorIds: [] }) }));
}
