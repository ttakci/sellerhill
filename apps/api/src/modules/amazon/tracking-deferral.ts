/**
 * Bounded deferral for the eBay shipped-tracking push.
 *
 * eBay's Fulfillment API has no update endpoint — whatever tracking number
 * reaches eBay on the first push is what the buyer sees forever. Aquiline's
 * `uploadTrackingHtml` can answer `outcome: accepted` while
 * `trackingUpdateStatus` is still `processing`, and its own docs warn against
 * treating that success alone as applied. Whether `assign` succeeds
 * immediately after such an upload is unresolved with the provider, so a
 * RETRYABLE conversion failure is worth a short wait rather than committing
 * to the raw Amazon number immediately.
 *
 * The wait is bounded, though: a shipment with NO tracking number is worse
 * than one carrying the honest Amazon number, so once `windowHours` has
 * elapsed since the order was first observed shipped, the push must go
 * through with whatever number is available.
 */

/** eBay's handling-time expectation is about one business day; 12h leaves room. */
export const DEFERRAL_WINDOW_HOURS = 12;
export const DEFERRAL_RETRY_INTERVAL_HOURS = 1;

export function shouldDeferEbayPush(input: {
  retryable: boolean;
  shippedDetectedAt: Date | null;
  now: Date;
  windowHours: number;
}): boolean {
  if (!input.retryable || !input.shippedDetectedAt) {
    return false;
  }
  const elapsedHours = (input.now.getTime() - input.shippedDetectedAt.getTime()) / 3_600_000;
  return elapsedHours < input.windowHours;
}
