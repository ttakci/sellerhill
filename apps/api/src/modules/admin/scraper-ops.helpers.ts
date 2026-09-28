import type { ScraperStats } from '@repo/shared';

/**
 * Requests the scraper counts toward its health rates in the last hour.
 * `expired` (deadline) and `proxyError` (transport/dead proxy) are left out:
 * neither is Amazon answering, so neither may read as Amazon blocking us or
 * as our parser failing.
 */
function answered(stats: ScraperStats): number {
  const w = stats.window1h;
  return w.found + w.notFound + w.blocked + w.parseFailed;
}

function percentOf(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 1000) / 10;
}

/**
 * Share of scraper requests blocked (captcha / dogs page) in the last hour, as
 * a rounded percent (one decimal place). `null` when the window saw no traffic
 * at all — a zero denominator must not read as "0% blocked".
 */
export function blockRatePercent(stats: ScraperStats): number | null {
  return percentOf(stats.window1h.blocked, answered(stats));
}

/**
 * Share of scraper requests whose page could not be parsed in the last hour.
 * A spike is almost always an Amazon layout change: those products go down the
 * data-failure path (escalating backoff, then quarantine) — so this, not the
 * block rate, is the alarm for a parser break. A DOM change actually LOWERS the
 * block rate, because it inflates the shared denominator.
 */
export function parseFailureRatePercent(stats: ScraperStats): number | null {
  return percentOf(stats.window1h.parseFailed, answered(stats));
}

/**
 * Share of scraper requests in the last hour that never got an answer from
 * Amazon at all: `proxyError` (dead exit, wrong proxy credentials, repeated
 * 5xx) plus `expired` (deadline). Taken over EVERY outcome, since neither is
 * in the `answered` denominator the other two rates use — a wrong-password
 * proxy list answers nothing but these, so without this rate no warning fires
 * and the last-hour card reads 0 · 0 · 0. `null` with no traffic at all.
 */
export function transportFailureRatePercent(stats: ScraperStats): number | null {
  const w = stats.window1h;
  const failed = (w.proxyError ?? 0) + (w.expired ?? 0);
  return percentOf(failed, answered(stats) + failed);
}

/**
 * How many full refresh passes the scraper's proxy pool can sustain per day
 * against the given ASIN workload: `proxies × requests/sec/proxy × 86,400
 * seconds × (1 − reserve) / unique ASINs`. The reserve is the same headroom the
 * refresh batch size keeps for seller-triggered creates, so this figure and the
 * refresh throughput agree. `null` when there is no workload to divide by —
 * zero ASINs is "nothing to measure against", not zero capacity.
 */
export function achievableSyncsPerDay(
  proxyCount: number,
  perIpRequestsPerSecond: number,
  uniqueAsins: number,
  reservePercent: number,
): number | null {
  if (uniqueAsins <= 0) {
    return null;
  }
  const share = 1 - Math.min(Math.max(reservePercent, 0), 100) / 100;
  return (proxyCount * perIpRequestsPerSecond * 86_400 * share) / uniqueAsins;
}
