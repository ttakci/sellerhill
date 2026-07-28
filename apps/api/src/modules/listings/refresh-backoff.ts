/**
 * Escalating retry delay (minutes) for Keepa DATA failures (ASIN missing from
 * an otherwise-successful response). Transport failures are handled by BullMQ
 * backoff instead; this schedule only governs next_refresh_at so a bad ASIN
 * cannot consume tokens on every scheduler tick.
 */
const DATA_FAILURE_DELAYS_MINUTES = [5, 15, 60, 240];

export function dataFailureDelayMinutes(
  failureCount: number,
  maxFailures: number,
  quarantineMinutes: number
): number {
  if (failureCount >= maxFailures) {
    return quarantineMinutes;
  }
  const index = Math.min(Math.max(failureCount - 1, 0), DATA_FAILURE_DELAYS_MINUTES.length - 1);
  return DATA_FAILURE_DELAYS_MINUTES[index];
}
