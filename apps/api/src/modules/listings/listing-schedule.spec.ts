import {
  LISTING_SCHEDULE_MAX_DAYS,
  normalizeListingSchedule,
  planListingSchedule,
  type ListingSchedule,
} from '@repo/shared';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 2026-10-05 00:00:00 UTC — a Monday midnight, so local hours are easy to read. */
const MIDNIGHT = Date.UTC(2026, 9, 5);

const schedule = (over: Partial<ListingSchedule> = {}): ListingSchedule => ({
  perDay: 20,
  startHour: 9,
  endHour: 19,
  utcOffsetMinutes: 0,
  ...over,
});

const total = (plan: { groups: Array<{ count: number }> }): number =>
  plan.groups.reduce((sum, group) => sum + group.count, 0);

describe('normalizeListingSchedule', () => {
  it('accepts a well-formed schedule', () => {
    expect(normalizeListingSchedule({ perDay: 20, startHour: 9, endHour: 19, utcOffsetMinutes: 180 })).toEqual({
      perDay: 20,
      startHour: 9,
      endHour: 19,
      utcOffsetMinutes: 180,
    });
  });

  it('answers null for anything unusable, so the job runs at once instead of waiting forever', () => {
    expect(normalizeListingSchedule(undefined)).toBeNull();
    expect(normalizeListingSchedule({ perDay: 0, startHour: 9, endHour: 19, utcOffsetMinutes: 0 })).toBeNull();
    expect(normalizeListingSchedule({ perDay: 20, startHour: 19, endHour: 9, utcOffsetMinutes: 0 })).toBeNull();
    expect(normalizeListingSchedule({ perDay: 20, startHour: 9, endHour: 19 })).toBeNull();
    expect(normalizeListingSchedule({ perDay: 20, startHour: 9, endHour: 19, utcOffsetMinutes: 5000 })).toBeNull();
  });
});

describe('planListingSchedule', () => {
  it('places every item exactly once', () => {
    const plan = planListingSchedule(137, schedule(), MIDNIGHT);
    expect(plan).not.toBeNull();
    expect(total(plan!)).toBe(137);
  });

  it('never starts more than perDay items on one calendar day', () => {
    const plan = planListingSchedule(65, schedule({ perDay: 20 }), MIDNIGHT)!;
    const perDay = new Map<number, number>();
    for (const group of plan.groups) {
      const day = Math.floor((MIDNIGHT + group.delayMs) / DAY);
      perDay.set(day, (perDay.get(day) ?? 0) + group.count);
    }
    expect([...perDay.values()]).toEqual([20, 20, 20, 5]);
    expect(plan.days).toBe(4);
  });

  it('keeps every group inside the daily window', () => {
    const plan = planListingSchedule(100, schedule({ startHour: 9, endHour: 19 }), MIDNIGHT)!;
    for (const group of plan.groups) {
      const hour = ((MIDNIGHT + group.delayMs) % DAY) / HOUR;
      expect(hour).toBeGreaterThanOrEqual(9);
      expect(hour).toBeLessThan(19);
    }
  });

  it('spreads a day across the window instead of emptying it in the first slot', () => {
    // 20 a day over 20 half-hour slots → one item per slot.
    const plan = planListingSchedule(20, schedule(), MIDNIGHT)!;
    expect(plan.groups).toHaveLength(20);
    expect(plan.groups.every((group) => group.count === 1)).toBe(true);
    expect(plan.groups[1].delayMs - plan.groups[0].delayMs).toBe(HOUR / 2);
  });

  it('never puts more than 25 items in one group (the eBay bulk size)', () => {
    const plan = planListingSchedule(500, schedule({ perDay: 500, startHour: 9, endHour: 11 }), MIDNIGHT)!;
    expect(Math.max(...plan.groups.map((group) => group.count))).toBeLessThanOrEqual(25);
  });

  it('skips the slots of today that are already past and rolls the rest to tomorrow', () => {
    // 18:15 local: only the 18:30 slot is left today.
    const now = MIDNIGHT + 18 * HOUR + 15 * 60_000;
    const plan = planListingSchedule(5, schedule({ perDay: 20 }), now)!;
    expect(plan.groups[0]).toEqual({ count: 1, delayMs: 15 * 60_000 });
    // The next group is tomorrow at 09:00.
    expect(now + plan.groups[1].delayMs).toBe(MIDNIGHT + DAY + 9 * HOUR);
  });

  it('reads the window in the seller local time, not UTC', () => {
    // UTC+3: 09:00 local is 06:00 UTC.
    const plan = planListingSchedule(1, schedule({ utcOffsetMinutes: 180 }), MIDNIGHT)!;
    expect(MIDNIGHT + plan.groups[0].delayMs).toBe(MIDNIGHT + 6 * HOUR);
  });

  it('refuses a plan that would run past the maximum', () => {
    expect(planListingSchedule(LISTING_SCHEDULE_MAX_DAYS * 2 + 1, schedule({ perDay: 2 }), MIDNIGHT)).toBeNull();
    expect(planListingSchedule(LISTING_SCHEDULE_MAX_DAYS * 2, schedule({ perDay: 2 }), MIDNIGHT)).not.toBeNull();
  });

  it('answers an empty plan for no items', () => {
    expect(planListingSchedule(0, schedule(), MIDNIGHT)).toEqual({ groups: [], endsAtMs: MIDNIGHT, days: 0 });
  });
});
