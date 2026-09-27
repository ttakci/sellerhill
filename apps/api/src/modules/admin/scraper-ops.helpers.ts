import type { ScraperStats } from '@repo/shared';

/**
 * Share of scraper requests blocked in the last hour, as a rounded percent
 * (one decimal place). `null` when the window saw no traffic at all — a zero
 * denominator must not read as "0% blocked".
 */
export function blockRatePercent(stats: ScraperStats): number | null {
  const w = stats.window1h;
  const total = w.found + w.notFound + w.blocked + w.parseFailed;
  return total === 0 ? null : Math.round((w.blocked / total) * 1000) / 10;
}

/**
 * How many full refresh passes the scraper's proxy pool can sustain per day
 * against the given ASIN workload: `proxies × requests/sec/proxy × 86,400
 * seconds / unique ASINs`. `null` when there is no workload to divide by —
 * zero ASINs is "nothing to measure against", not zero capacity.
 */
export function achievableSyncsPerDay(proxyCount: number, perIpRequestsPerSecond: number, uniqueAsins: number): number | null {
  if (uniqueAsins <= 0) {
    return null;
  }
  return (proxyCount * perIpRequestsPerSecond * 86_400) / uniqueAsins;
}
