import { EbayApiResource } from '@repo/shared';

import {
  mapRateLimits,
  parseRateLimitsResponse,
  pickDailyWindow,
} from './ebay-rate-limits';

const rate = (limit: number, timeWindow: number, remaining = limit, reset = '2026-09-26T00:00:00.000Z') => ({
  count: limit - remaining,
  limit,
  remaining,
  reset,
  timeWindow,
});

/** Shape copied from a real getRateLimits body (sandbox capture, 2026-09-25) with production names. */
const body = {
  rateLimits: [
    { apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [rate(2_000_000, 86_400, 1_999_000)] }] },
    { apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resources: [{ name: 'commerce.taxonomy', rates: [rate(5_000, 86_400)] }, { name: 'commerce.taxonomy.bulk', rates: [rate(100, 86_400)] }] },
    { apiContext: 'sell', apiName: 'Account', apiVersion: 'v1', resources: [{ name: 'sell.account', rates: [rate(25_000, 86_400)] }] },
    {
      apiContext: 'sell', apiName: 'Fulfillment', apiVersion: 'v1',
      resources: [
        { name: 'sell.fulfillment', rates: [rate(100_000, 86_400, 90_000)] },
        { name: 'sell.fulfillment.payment_dispute', rates: [rate(250_000, 86_400), rate(5_000, 300)] },
      ],
    },
    { apiContext: 'sell', apiName: 'Feed', apiVersion: 'v1', resources: [{ name: 'sell.feed', rates: [rate(100_000, 86_400)] }] },
    { apiContext: 'developer', apiName: 'Analytics', apiVersion: 'v1_beta', resources: [{ name: 'developer.analytics.app_rate_limit', rates: [rate(5_000, 86_400)] }] },
    {
      apiContext: 'TradingAPI', apiName: 'TradingAPI', apiVersion: 'v1',
      resources: [
        { name: 'AddItem', rates: [rate(100_000, 86_400)] },
        { name: 'GetMyeBaySelling', rates: [rate(5_000, 86_400, 4_000)] },
        { name: 'EndItem', rates: [rate(5_000, 86_400, 4_900)] },
      ],
    },
    { apiContext: 'commerce', apiName: 'Media', apiVersion: 'v1_beta', resources: [{ name: 'Image' }] },
  ],
};

describe('parseRateLimitsResponse', () => {
  it('flattens every resource with its windows', () => {
    const flat = parseRateLimitsResponse(body);
    const inventory = flat.find((r) => r.resourceName === 'sell.inventory');
    expect(inventory).toEqual({
      apiContext: 'sell',
      apiName: 'Inventory',
      apiVersion: 'v1',
      resourceName: 'sell.inventory',
      windows: [{ limit: 2_000_000, remaining: 1_999_000, timeWindowSeconds: 86_400, resetAt: '2026-09-26T00:00:00.000Z' }],
    });
  });

  it('keeps a resource that reports no rates, with no windows', () => {
    const image = parseRateLimitsResponse(body).find((r) => r.resourceName === 'Image');
    expect(image?.windows).toEqual([]);
  });

  it('drops malformed rates and nameless resources instead of throwing', () => {
    const flat = parseRateLimitsResponse({
      rateLimits: [
        { apiContext: 'x', apiName: 'y', apiVersion: 'v1', resources: [{ rates: [rate(1, 86_400)] }, { name: 'ok', rates: [{ limit: 'nope' }, rate(10, 86_400)] }] },
      ],
    });
    expect(flat).toHaveLength(1);
    expect(flat[0].windows).toHaveLength(1);
  });

  it.each([null, undefined, 'text', 42, {}, { rateLimits: 'x' }])('returns [] for %p', (input) => {
    expect(parseRateLimitsResponse(input)).toEqual([]);
  });
});

describe('pickDailyWindow', () => {
  it('treats a window longer than 86400s as daily', () => {
    const picked = pickDailyWindow([{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 89_999, resetAt: null }]);
    expect(picked?.limit).toBe(5_000);
  });

  it('ignores sub-daily windows', () => {
    expect(pickDailyWindow([{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 300, resetAt: null }])).toBeNull();
  });

  it('prefers the lowest daily limit when several qualify', () => {
    const picked = pickDailyWindow([
      { limit: 9_000, remaining: 9_000, timeWindowSeconds: 86_400, resetAt: null },
      { limit: 5_000, remaining: 4_000, timeWindowSeconds: 172_800, resetAt: null },
    ]);
    expect(picked?.limit).toBe(5_000);
  });

  it('returns null for no windows', () => {
    expect(pickDailyWindow([])).toBeNull();
  });
});

describe('mapRateLimits', () => {
  const mapped = mapRateLimits(parseRateLimitsResponse(body));

  it.each([
    [EbayApiResource.INVENTORY, 2_000_000, 1_999_000],
    [EbayApiResource.TAXONOMY, 5_000, 5_000],
    [EbayApiResource.ACCOUNT, 25_000, 25_000],
    [EbayApiResource.FULFILLMENT, 100_000, 90_000],
    [EbayApiResource.FEED, 100_000, 100_000],
    [EbayApiResource.ANALYTICS, 5_000, 5_000],
  ])('maps %s by its exact eBay resource name', (resource, limit, remaining) => {
    expect(mapped.byResource[resource]).toMatchObject({ limit, remaining, partial: false });
  });

  it('does not let a longer name that merely starts with a mapped one take its place', () => {
    // sell.fulfillment.payment_dispute is 250,000 — it must not become Fulfillment's ceiling.
    expect(mapped.byResource[EbayApiResource.FULFILLMENT]?.sourceResources).toEqual(['sell.fulfillment']);
  });

  it('maps Trading to the lowest daily limit among the methods we call, marked partial', () => {
    expect(mapped.byResource[EbayApiResource.TRADING]).toMatchObject({
      limit: 5_000,
      partial: true,
      sourceResources: ['GetMyeBaySelling', 'EndItem'],
    });
    // Remaining is that of the method the limit came from (GetMyeBaySelling, first of equals).
    expect(mapped.byResource[EbayApiResource.TRADING]?.remaining).toBe(4_000);
  });

  it('puts every resource no governed resource uses in unmapped', () => {
    const names = mapped.unmapped.map((r) => r.resourceName).sort();
    expect(names).toEqual(['AddItem', 'Image', 'commerce.taxonomy.bulk', 'sell.fulfillment.payment_dispute'].sort());
  });

  it('keeps sub-daily windows of a mapped source as otherWindows', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [rate(2_000_000, 86_400), rate(5_400, 60)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.INVENTORY]?.otherWindows).toEqual([
      { limit: 5_400, remaining: 5_400, timeWindowSeconds: 60, resetAt: '2026-09-26T00:00:00.000Z' },
    ]);
  });

  it('returns null — never 0 — when eBay no longer reports a mapped name', () => {
    const m = mapRateLimits([]);
    for (const resource of Object.values(EbayApiResource)) {
      expect(m.byResource[resource]).toBeNull();
    }
  });

  it('returns null when a mapped source reports only sub-daily windows', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Feed', apiVersion: 'v1', resources: [{ name: 'sell.feed', rates: [rate(50, 3_600)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.FEED]).toBeNull();
    // Matched, so it is not unmapped either.
    expect(m.unmapped).toEqual([]);
  });

  it('does not match Trading method names outside a Trading entry', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Other', apiVersion: 'v1', resources: [{ name: 'EndItem', rates: [rate(1, 86_400)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.TRADING]).toBeNull();
    expect(m.unmapped).toHaveLength(1);
  });
});
