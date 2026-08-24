import { DEFERRAL_WINDOW_HOURS, shouldDeferEbayPush } from './tracking-deferral';

const START = new Date('2026-08-23T00:00:00Z');
const hours = (n: number) => new Date(START.getTime() + n * 3_600_000);

describe('shouldDeferEbayPush', () => {
  it('defers a retryable failure inside the window', () => {
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: START, now: hours(3), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(true);
  });

  it('stops deferring once the window expires, so eBay still gets a number', () => {
    // eBay has no fulfillment update endpoint, but a shipment with NO tracking
    // is worse than one with the raw Amazon number.
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: START, now: hours(13), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });

  it('never defers a terminal failure', () => {
    expect(
      shouldDeferEbayPush({ retryable: false, shippedDetectedAt: START, now: hours(1), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });

  it('does not defer when the shipped time is unknown', () => {
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: null, now: hours(1), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });
});
