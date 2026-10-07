/**
 * Slack added to a stamp-on-claim sweep's "is this store due?" test
 * (`last_x_at < NOW() - interval + slack`).
 *
 * The claim stamps `NOW()` a few milliseconds after its cron tick fires, and
 * the next tick one interval later can fire a few milliseconds EARLIER than
 * that stamp plus the interval. With a strict comparison the store is then
 * "not due yet" and waits a whole extra tick: on production the hourly
 * cancellation and return sweeps ran every 70 minutes instead of 60
 * (2026-10-07: stamped 17:20:00.137, the 18:20:00 tick skipped it). One
 * minute is far above the jitter and far below every tick spacing (10 min).
 */
export const SWEEP_DUE_SLACK_SQL = "INTERVAL '1 minute'";
