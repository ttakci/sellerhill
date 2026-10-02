/**
 * Spreading a bulk add over time ("drip listing").
 *
 * A seller picks how many products go live per day and between which hours;
 * the plan turns the job's items into small groups, each with the moment it
 * may start. Nothing about a product is decided here: product data is fetched,
 * the listing rules are checked and the plan slot is reserved when a group
 * actually runs, so a product scheduled for next week is listed from next
 * week's price and stock, not today's.
 *
 * Pure and deterministic — the same input always gives the same plan.
 */

export interface ListingSchedule {
  /** Most products started per (seller-local) calendar day. */
  perDay: number;
  /** Start of the daily window, seller-local hour 0–23. */
  startHour: number;
  /** End of the daily window (exclusive), seller-local hour 1–24. */
  endHour: number;
  /** The seller's offset from UTC in minutes, east positive (UTC+3 → 180). */
  utcOffsetMinutes: number;
}

export const LISTING_SCHEDULE_MIN_PER_DAY = 1;
export const LISTING_SCHEDULE_MAX_PER_DAY = 500;
/** A schedule that would run longer than this is refused rather than queued. */
export const LISTING_SCHEDULE_MAX_DAYS = 30;
/** Groups start this far apart inside the daily window. */
export const LISTING_SCHEDULE_SLOT_MINUTES = 30;
/** eBay's bulk maximum — one group is one bulk call. */
const MAX_GROUP_SIZE = 25;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function wholeNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.floor(value);
  return rounded >= min && rounded <= max ? rounded : null;
}

/**
 * Read a submitted schedule. Null when it is absent or unusable — the caller
 * then lists everything at once, which is what an unreadable schedule should
 * degrade to (never a job that silently waits forever).
 */
export function normalizeListingSchedule(raw: unknown): ListingSchedule | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const perDay = wholeNumber(source.perDay, LISTING_SCHEDULE_MIN_PER_DAY, LISTING_SCHEDULE_MAX_PER_DAY);
  const startHour = wholeNumber(source.startHour, 0, 23);
  const endHour = wholeNumber(source.endHour, 1, 24);
  // UTC−12 … UTC+14, the range real time zones occupy.
  const utcOffsetMinutes = wholeNumber(source.utcOffsetMinutes, -720, 840);
  if (perDay === null || startHour === null || endHour === null || utcOffsetMinutes === null) {
    return null;
  }
  if (endHour <= startHour) {
    return null;
  }
  return { perDay, startHour, endHour, utcOffsetMinutes };
}

export interface ListingScheduleGroup {
  /** How many items this group takes, in submission order. */
  count: number;
  /** Milliseconds from `nowMs` until the group may start (0 = now). */
  delayMs: number;
}

export interface ListingSchedulePlan {
  groups: ListingScheduleGroup[];
  /** When the last group starts (epoch ms). */
  endsAtMs: number;
  /** Seller-local calendar days the plan touches. */
  days: number;
}

/** How many calendar days `itemCount` items need at this pace (a lower bound). */
export function estimateScheduleDays(itemCount: number, schedule: ListingSchedule): number {
  return Math.max(1, Math.ceil(Math.max(0, itemCount) / schedule.perDay));
}

/**
 * Lay `itemCount` items out over the schedule, starting from `nowMs`.
 *
 * Each day offers one slot every 30 minutes inside the window. A slot takes at
 * most `ceil(perDay / slots)` items (capped at eBay's bulk size), so a day's
 * allowance is spread across the whole window instead of going out in its
 * first minutes. Today counts as a day: slots already past are skipped, and
 * what today's remaining slots cannot hold rolls to tomorrow.
 *
 * Returns null when the plan would run past `LISTING_SCHEDULE_MAX_DAYS`.
 */
export function planListingSchedule(
  itemCount: number,
  schedule: ListingSchedule,
  nowMs: number
): ListingSchedulePlan | null {
  const total = Math.max(0, Math.floor(itemCount));
  if (total === 0) {
    return { groups: [], endsAtMs: nowMs, days: 0 };
  }

  const offsetMs = schedule.utcOffsetMinutes * MINUTE_MS;
  const localNow = nowMs + offsetMs;
  const localMidnight = Math.floor(localNow / DAY_MS) * DAY_MS;
  const slotsPerDay = Math.max(
    1,
    Math.floor(((schedule.endHour - schedule.startHour) * 60) / LISTING_SCHEDULE_SLOT_MINUTES)
  );
  const perSlot = Math.min(MAX_GROUP_SIZE, Math.max(1, Math.ceil(schedule.perDay / slotsPerDay)));

  const groups: ListingScheduleGroup[] = [];
  let remaining = total;
  let endsAtMs = nowMs;
  let daysUsed = 0;

  for (let day = 0; day < LISTING_SCHEDULE_MAX_DAYS && remaining > 0; day += 1) {
    let leftToday = schedule.perDay;
    let usedToday = false;
    for (let slot = 0; slot < slotsPerDay && remaining > 0 && leftToday > 0; slot += 1) {
      const localStart =
        localMidnight + day * DAY_MS + (schedule.startHour * 60 + slot * LISTING_SCHEDULE_SLOT_MINUTES) * MINUTE_MS;
      const startMs = localStart - offsetMs;
      if (startMs < nowMs) {
        continue;
      }
      const count = Math.min(perSlot, leftToday, remaining);
      groups.push({ count, delayMs: startMs - nowMs });
      remaining -= count;
      leftToday -= count;
      endsAtMs = startMs;
      usedToday = true;
    }
    if (usedToday) {
      daysUsed += 1;
    }
  }

  if (remaining > 0) {
    return null;
  }
  return { groups, endsAtMs, days: daysUsed };
}
