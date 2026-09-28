/**
 * May a cached `products` row be LISTED from without asking Amazon again?
 *
 * The refresh pipeline only visits products with an ACTIVE listing, so a row
 * whose listing attempts all failed — or whose listings all ended — is never
 * refreshed: it can be days old and describe a product Amazon has since
 * removed. `asUsableCache` used to accept any row with a title, an image and
 * a price, and two such ASINs (already gone from amazon.com) were published
 * live, with image URLs eBay could no longer fetch.
 *
 * Fresh means: not reported removed by the source, AND refreshed within
 * `maxAgeMs` (the create path uses the refresh interval, so a product that is
 * on the refresh schedule is always a hit, and one that is not pays one page
 * fetch — exactly the row that needs it). Unknown age and a misread window
 * both fail towards a re-fetch, never towards serving stale data for ever.
 */
export function isCreateCacheFresh(
  row: { updatedAt?: string; sourceRemoved?: boolean },
  nowMs: number,
  maxAgeMs: number
): boolean {
  if (row.sourceRemoved) {
    return false;
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return false;
  }
  const updatedMs = row.updatedAt ? Date.parse(row.updatedAt) : Number.NaN;
  if (!Number.isFinite(updatedMs)) {
    return false;
  }
  return nowMs - updatedMs <= maxAgeMs;
}
