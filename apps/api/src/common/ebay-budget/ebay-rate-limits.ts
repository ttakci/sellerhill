import {
  EbayApiResource,
  type EbayRateLimitResourceDto,
  type EbayRateWindowDto,
} from '@repo/shared';

/**
 * Pure reading of eBay's `getRateLimits` response.
 *
 * eBay is the only source of a ceiling (spec D1): these functions turn its
 * answer into what the governor and the admin panel need, and are deliberately
 * tolerant — a response we cannot read must degrade to "no figure", never to a
 * zero ceiling that would stop every call.
 */

/** A window at least this long is a daily ceiling. eBay reports 89,999s for some. */
export const DAILY_WINDOW_MIN_SECONDS = 86_400;

/**
 * The Trading methods this codebase actually calls — the only two
 * `X-EBAY-API-CALL-NAME` values in `apps/api/src/modules`. Adding a Trading call
 * means adding its name here, or its quota is not governed.
 */
export const TRADING_METHODS_WE_CALL: readonly string[] = ['GetMyeBaySelling', 'EndItem'];

/** Exact eBay resource name per REST resource. Exact on purpose: `sell.fulfillment.payment_dispute` is a different bucket. */
const REST_SOURCE: Record<Exclude<EbayApiResource, EbayApiResource.TRADING>, string> = {
  [EbayApiResource.INVENTORY]: 'sell.inventory',
  [EbayApiResource.TAXONOMY]: 'commerce.taxonomy',
  [EbayApiResource.ACCOUNT]: 'sell.account',
  [EbayApiResource.FULFILLMENT]: 'sell.fulfillment',
  [EbayApiResource.FEED]: 'sell.feed',
  [EbayApiResource.ANALYTICS]: 'developer.analytics.app_rate_limit',
};

export interface MappedLimit {
  limit: number;
  remaining: number;
  resetAt: string | null;
  sourceResources: string[];
  partial: boolean;
  otherWindows: EbayRateWindowDto[];
}

export interface MappedRateLimits {
  byResource: Record<EbayApiResource, MappedLimit | null>;
  unmapped: EbayRateLimitResourceDto[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseWindow(raw: unknown): EbayRateWindowDto | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { limit, remaining, timeWindow, reset } = raw;
  if (typeof limit !== 'number' || typeof timeWindow !== 'number' || !Number.isFinite(limit) || !Number.isFinite(timeWindow)) {
    return null;
  }
  return {
    limit,
    remaining: typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : limit,
    timeWindowSeconds: timeWindow,
    resetAt: typeof reset === 'string' ? reset : null,
  };
}

export function parseRateLimitsResponse(body: unknown): EbayRateLimitResourceDto[] {
  if (!isRecord(body) || !Array.isArray(body.rateLimits)) {
    return [];
  }
  const out: EbayRateLimitResourceDto[] = [];
  for (const entry of body.rateLimits) {
    if (!isRecord(entry) || !Array.isArray(entry.resources)) {
      continue;
    }
    for (const resource of entry.resources) {
      if (!isRecord(resource) || !str(resource.name)) {
        continue;
      }
      const rates = Array.isArray(resource.rates) ? resource.rates : [];
      out.push({
        apiContext: str(entry.apiContext),
        apiName: str(entry.apiName),
        apiVersion: str(entry.apiVersion),
        resourceName: str(resource.name),
        windows: rates.map(parseWindow).filter((w): w is EbayRateWindowDto => w !== null),
      });
    }
  }
  return out;
}

export function pickDailyWindow(windows: EbayRateWindowDto[]): EbayRateWindowDto | null {
  let best: EbayRateWindowDto | null = null;
  for (const window of windows) {
    if (window.timeWindowSeconds < DAILY_WINDOW_MIN_SECONDS) {
      continue;
    }
    if (!best || window.limit < best.limit) {
      best = window;
    }
  }
  return best;
}

const isTradingEntry = (r: EbayRateLimitResourceDto): boolean =>
  /trading/i.test(r.apiContext) || /trading/i.test(r.apiName);

export function mapRateLimits(resources: EbayRateLimitResourceDto[]): MappedRateLimits {
  const used = new Set<EbayRateLimitResourceDto>();
  const byResource = {} as Record<EbayApiResource, MappedLimit | null>;

  for (const resource of Object.values(EbayApiResource)) {
    const sources =
      resource === EbayApiResource.TRADING
        ? resources.filter((r) => isTradingEntry(r) && TRADING_METHODS_WE_CALL.includes(r.resourceName))
        : resources.filter((r) => r.resourceName === REST_SOURCE[resource]);
    sources.forEach((s) => used.add(s));

    let chosen: { source: EbayRateLimitResourceDto; daily: EbayRateWindowDto } | null = null;
    for (const source of sources) {
      const daily = pickDailyWindow(source.windows);
      if (daily && (!chosen || daily.limit < chosen.daily.limit)) {
        chosen = { source, daily };
      }
    }

    byResource[resource] = chosen
      ? {
          limit: chosen.daily.limit,
          remaining: chosen.daily.remaining,
          resetAt: chosen.daily.resetAt,
          sourceResources: sources.map((s) => s.resourceName),
          partial: resource === EbayApiResource.TRADING,
          otherWindows: chosen.source.windows.filter((w) => w.timeWindowSeconds < DAILY_WINDOW_MIN_SECONDS),
        }
      : null;
  }

  return { byResource, unmapped: resources.filter((r) => !used.has(r)) };
}
