/**
 * Per-key minimum-interval pacer for EPS image uploads.
 *
 * eBay's Media API allows 50 POSTs per 5 seconds per user (10/s). The upload
 * loop in `EbayImageResolver.resolve` is sequential per PRODUCT, which alone
 * stays far under that — but the listing batch now prepares several products
 * of the SAME store concurrently, and N sequential loops in parallel are only
 * accidentally under the limit while each upload is slow. This makes the
 * ceiling explicit: callers ask `reserve(storeId, now)` how long to wait
 * before their next upload, and consecutive reservations on one store are
 * spaced `minIntervalMs` apart whatever the callers' own timing.
 *
 * Pure arithmetic — no timers, no clock of its own — so it is testable to the
 * millisecond and the caller owns the actual sleep.
 */
export class EpsUploadPacer {
  private readonly minIntervalMs: number;
  private readonly nextAtByKey = new Map<string, number>();

  constructor(minIntervalMs: number) {
    // A bad interval must never become a stuck queue: no pacing beats
    // infinite pacing, and eBay's own 429 backoff still bounds the worst case.
    this.minIntervalMs =
      Number.isFinite(minIntervalMs) && minIntervalMs > 0 ? minIntervalMs : 0;
  }

  /**
   * Reserve the next upload slot for `key` and return how many ms the caller
   * must wait before using it. `0` means "go now". An idle key carries no
   * debt: the schedule restarts from `nowMs` rather than from where the last
   * burst left off.
   */
  reserve(key: string, nowMs: number): number {
    const slot = Math.max(nowMs, this.nextAtByKey.get(key) ?? 0);
    this.nextAtByKey.set(key, slot + this.minIntervalMs);
    this.prune(nowMs);
    return slot - nowMs;
  }

  /** Drop keys whose window has fully passed, so the map cannot grow for ever. */
  private prune(nowMs: number): void {
    if (this.nextAtByKey.size <= 64) {
      return;
    }
    for (const [key, nextAt] of this.nextAtByKey) {
      if (nextAt <= nowMs) {
        this.nextAtByKey.delete(key);
      }
    }
  }
}
