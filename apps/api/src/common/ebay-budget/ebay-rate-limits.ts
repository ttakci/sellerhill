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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseWindow(raw: unknown): EbayRateWindowDto | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { limit, remaining, timeWindow, reset } = raw;
  if (
    typeof limit !== 'number' ||
    typeof timeWindow !== 'number' ||
    !Number.isFinite(limit) ||
    !Number.isFinite(timeWindow) ||
    limit < 0 ||
    timeWindow <= 0
  ) {
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

/** Where eBay reports each governed resource. Trading methods are resource names inside the Trading entry. */
export interface ResourceSource {
  trading: boolean;
  name: string;
}

/**
 * Exact eBay resource name per governed resource. Exact on purpose:
 * `sell.fulfillment.payment_dispute` is a different bucket from
 * `sell.fulfillment`, and a Trading method name only counts inside the
 * Trading entry.
 */
export const RESOURCE_SOURCE: Record<EbayApiResource, ResourceSource> = {
  [EbayApiResource.INVENTORY]: { trading: false, name: 'sell.inventory' },
  [EbayApiResource.TAXONOMY]: { trading: false, name: 'commerce.taxonomy' },
  [EbayApiResource.ACCOUNT]: { trading: false, name: 'sell.account' },
  [EbayApiResource.FULFILLMENT]: { trading: false, name: 'sell.fulfillment' },
  [EbayApiResource.FEED]: { trading: false, name: 'sell.feed' },
  [EbayApiResource.ANALYTICS]: { trading: false, name: 'developer.analytics.app_rate_limit' },
  [EbayApiResource.TRADING_GET_MY_EBAY_SELLING]: { trading: true, name: 'GetMyeBaySelling' },
  [EbayApiResource.TRADING_END_ITEM]: { trading: true, name: 'EndItem' },
};

/**
 * What eBay says about one governed resource. A resource may carry several
 * windows (eBay reports e.g. 5,400/60s AND 5,000/day for one resource); the
 * governor enforces every one of them.
 */
export interface MappedLimit {
  /** The daily window (lowest limit among windows >= 1 day), or null when eBay reports only shorter ones. */
  daily: EbayRateWindowDto | null;
  /** One window per distinct sub-daily length, lowest limit, sorted by length. */
  shortWindows: EbayRateWindowDto[];
  /** The eBay resource name this came from. */
  sourceResource: string;
}

export interface MappedRateLimits {
  byResource: Record<EbayApiResource, MappedLimit | null>;
  unmapped: EbayRateLimitResourceDto[];
}

export function pickShortWindows(windows: EbayRateWindowDto[]): EbayRateWindowDto[] {
  const byLength = new Map<number, EbayRateWindowDto>();
  for (const window of windows) {
    if (window.timeWindowSeconds >= DAILY_WINDOW_MIN_SECONDS) {
      continue;
    }
    const current = byLength.get(window.timeWindowSeconds);
    if (!current || window.limit < current.limit) {
      byLength.set(window.timeWindowSeconds, window);
    }
  }
  return [...byLength.values()].sort((a, b) => a.timeWindowSeconds - b.timeWindowSeconds);
}

const isTradingEntry = (r: EbayRateLimitResourceDto): boolean =>
  /trading/i.test(r.apiContext) || /trading/i.test(r.apiName);

export function mapRateLimits(resources: EbayRateLimitResourceDto[]): MappedRateLimits {
  const used = new Set<EbayRateLimitResourceDto>();
  const byResource = {} as Record<EbayApiResource, MappedLimit | null>;

  for (const resource of Object.values(EbayApiResource)) {
    const source = RESOURCE_SOURCE[resource];
    const matches = resources.filter(
      (r) => r.resourceName === source.name && isTradingEntry(r) === source.trading,
    );
    matches.forEach((m) => used.add(m));

    const windows = matches.flatMap((m) => m.windows);
    const daily = pickDailyWindow(windows);
    const shortWindows = pickShortWindows(windows);
    byResource[resource] =
      daily || shortWindows.length > 0 ? { daily, shortWindows, sourceResource: source.name } : null;
  }

  return { byResource, unmapped: resources.filter((r) => !used.has(r)) };
}
