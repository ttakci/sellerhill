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

export function readCampaignsPage(body: unknown): { campaigns: ParsedCampaign[]; total: number | null } | null {
  if (!isObj(body)) {
    return null;
  }
  const campaigns: ParsedCampaign[] = [];
  for (const raw of Array.isArray(body.campaigns) ? body.campaigns : []) {
    if (!isObj(raw)) {
      continue;
    }
    const campaignId = str(raw.campaignId);
    if (!campaignId) {
      continue;
    }
    const funding = isObj(raw.fundingStrategy) ? raw.fundingStrategy : {};
    campaigns.push({
      campaignId,
      name: str(raw.campaignName) ?? '',
      status: str(raw.campaignStatus) ?? '',
      fundingModel: str(funding.fundingModel),
      adRateStrategy: str(funding.adRateStrategy),
      bidPercentage: num(funding.bidPercentage),
      ruleBased: isObj(raw.campaignCriterion),
      startDate: str(raw.startDate),
      endDate: str(raw.endDate),
    });
  }
  return { campaigns, total: num(body.total) };
}

export function readAdsPage(
  body: unknown
): { ads: Array<{ listingId: string; bidPercentage: number | null }>; total: number | null } | null {
  if (!isObj(body)) {
    return null;
  }
  const ads: Array<{ listingId: string; bidPercentage: number | null }> = [];
  for (const raw of Array.isArray(body.ads) ? body.ads : []) {
    if (!isObj(raw)) {
      continue;
    }
    const listingId = str(raw.listingId);
    if (listingId) {
      ads.push({ listingId, bidPercentage: num(raw.bidPercentage) });
    }
  }
  return { ads, total: num(body.total) };
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
