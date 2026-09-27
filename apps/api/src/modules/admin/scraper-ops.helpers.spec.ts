import type { ScraperStats } from '@repo/shared';

import {
  achievableSyncsPerDay,
  blockRatePercent,
  parseFailureRatePercent,
  transportFailureRatePercent,
} from './scraper-ops.helpers';

const stats = (over: Partial<ScraperStats['window1h']> = {}): ScraperStats => {
  const w = { found: 0, notFound: 0, blocked: 0, parseFailed: 0, noProxy: 0, expired: 0, proxyError: 0, ...over };
  return { window1h: w, window24h: w, meanLatencyMs: null, proxies: [] };
};

describe('scraper ops helpers', () => {
  it('block rate over the last hour, null with no traffic', () => {
    expect(blockRatePercent(stats({ found: 90, blocked: 10 }))).toBe(10);
    expect(blockRatePercent(stats())).toBeNull();
  });
  it('deadline expiry and proxy errors are never counted as blocked', () => {
    expect(blockRatePercent(stats({ found: 90, blocked: 10, expired: 500, proxyError: 500 }))).toBe(10);
    expect(blockRatePercent(stats({ expired: 5, proxyError: 5 }))).toBeNull();
  });
  it('parse-failure rate over the last hour, null with no traffic', () => {
    expect(parseFailureRatePercent(stats({ found: 60, notFound: 5, blocked: 5, parseFailed: 30 }))).toBe(30);
    expect(parseFailureRatePercent(stats({ found: 100 }))).toBe(0);
    expect(parseFailureRatePercent(stats())).toBeNull();
  });
  it('transport-failure rate = (proxyError + expired) over every outcome, null with no traffic', () => {
    // A well-formed but dead / wrong-password proxy list: nothing but proxy errors.
    expect(transportFailureRatePercent(stats({ proxyError: 40 }))).toBe(100);
    expect(blockRatePercent(stats({ proxyError: 40 }))).toBeNull();
    expect(transportFailureRatePercent(stats({ found: 80, proxyError: 10, expired: 10 }))).toBe(20);
    expect(transportFailureRatePercent(stats({ found: 100 }))).toBe(0);
    expect(transportFailureRatePercent(stats())).toBeNull();
    // An older service without the fields reads as no failures, never NaN.
    const legacy = { window1h: { found: 10, notFound: 0, blocked: 0, parseFailed: 0, noProxy: 0 } } as ScraperStats;
    expect(transportFailureRatePercent(legacy)).toBe(0);
  });
  it('syncs/day =proxies × rps × 86400 × (1 − reserve) / unique ASINs', () => {
    expect(achievableSyncsPerDay(5, 1, 200_000, 0)).toBeCloseTo(2.16, 2);
    expect(achievableSyncsPerDay(5, 1, 200_000, 20)).toBeCloseTo(1.728, 3);
    expect(achievableSyncsPerDay(5, 1, 0, 20)).toBeNull();
    expect(achievableSyncsPerDay(0, 1, 1000, 20)).toBe(0);
  });
});
