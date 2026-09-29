/**
 * Whether a listing's revisions view should tell the seller "checked, no
 * change" — true when the product's underlying source data was verified more
 * recently than the last recorded price/quantity change (or nothing has ever
 * changed but a check has happened at least once).
 *
 * `listing_revisions` only ever gets a row when a refresh actually pushed a
 * different price/quantity to eBay (see migration `076`) — writing one on
 * every unchanged tick would be a write per listing per refresh cycle across
 * the whole catalog for no new information. This function instead reads the
 * two timestamps the product row already carries for free
 * (`products.last_successful_refresh_at` and the newest `recorded_at`) so the
 * seller can still tell "it ran and nothing moved" from "it has never run".
 *
 * A revision's `recorded_at` is written slightly AFTER the SAME refresh
 * cycle's `last_successful_refresh_at` (the eBay push that creates it runs
 * after the refresh already stamped the check time), so right after a real
 * change `checked <= revised` and this correctly stays false until a LATER
 * refresh checks again with nothing new to report.
 */
export function hasUncommittedRefreshCheck(
  lastCheckedAt: Date | string | null,
  mostRecentRevisionAt: Date | string | null
): boolean {
  if (!lastCheckedAt) {
    return false;
  }
  const checked = new Date(lastCheckedAt).getTime();
  if (!mostRecentRevisionAt) {
    return true;
  }
  const revised = new Date(mostRecentRevisionAt).getTime();
  return checked > revised;
}
