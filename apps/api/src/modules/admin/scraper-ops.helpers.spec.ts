import { achievableSyncsPerDay, blockRatePercent } from './scraper-ops.helpers';

const stats = (found: number, blocked: number) => ({
  window1h: { found, notFound: 0, blocked, parseFailed: 0, noProxy: 0 },
  window24h: { found, notFound: 0, blocked, parseFailed: 0, noProxy: 0 },
  meanLatencyMs: null,
  proxies: [],
});

describe('scraper ops helpers', () => {
  it('block rate over the last hour, null with no traffic', () => {
    expect(blockRatePercent(stats(90, 10))).toBe(10);
    expect(blockRatePercent(stats(0, 0))).toBeNull();
  });
  it('syncs/day = proxies × rps × 86400 / unique ASINs', () => {
    expect(achievableSyncsPerDay(5, 1, 200_000)).toBeCloseTo(2.16, 2);
    expect(achievableSyncsPerDay(5, 1, 0)).toBeNull();
    expect(achievableSyncsPerDay(0, 1, 1000)).toBe(0);
  });
});
