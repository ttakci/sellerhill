/**
 * Whether a listing's revisions view should tell the seller "checked, no
 * change" — true when the product's underlying source data was verified more
 * recently than the last recorded price/quantity change (or nothing has ever
 * changed but a check has happened at least once).
 *
 * Since 2026-09-30 the refresh worker also writes a "checked, nothing moved"
 * row (previous = new) for every active listing it verified
 * (`ProductSyncService.recordUnchangedChecks`), so this banner only covers
 * what those rows cannot: history from before that change and a listing whose
 * refresh check landed after its newest row. It reads the two timestamps the
 * product row already carries (`products.last_successful_refresh_at` and the
 * newest `recorded_at`) so the seller can still tell "it ran and nothing
 * moved" from "it has never run".
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
