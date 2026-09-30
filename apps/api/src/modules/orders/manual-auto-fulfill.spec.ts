import {
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  MANUALLY_RETRYABLE_BLOCKED_REASONS,
  OrderStatus,
  canStartAutoFulfillManually,
  type ManualAutoFulfillInput,
} from '@repo/shared';

/**
 * `canStartAutoFulfillManually` decides whether the seller's "Start automatic
 * order" button may re-arm a real Amazon purchase. Its failure mode is a
 * second Amazon order, so the matrix below pins every status × reason pair.
 */
const base: ManualAutoFulfillInput = {
  status: OrderStatus.WAITING_SHIPMENT,
  isTracked: true,
  listingOverPlanLimit: false,
  autoFulfillStatus: AutoFulfillStatus.BLOCKED,
  autoFulfillBlockedReason: AutoFulfillBlockedReason.PAYMENT,
  amazonOrderId: null,
};

describe('canStartAutoFulfillManually', () => {
  it('allows every retryable blocked reason', () => {
    for (const reason of MANUALLY_RETRYABLE_BLOCKED_REASONS) {
      expect(canStartAutoFulfillManually({ ...base, autoFulfillBlockedReason: reason })).toBe(true);
    }
  });

  it('refuses every other blocked reason — the ones where the Place Order click may have gone out', () => {
    const refused = Object.values(AutoFulfillBlockedReason).filter(
      (r) => !MANUALLY_RETRYABLE_BLOCKED_REASONS.includes(r)
    );
    expect(refused).toEqual(
      expect.arrayContaining([AutoFulfillBlockedReason.NO_CONFIRMATION, AutoFulfillBlockedReason.INTERRUPTED])
    );
    for (const reason of refused) {
      expect(canStartAutoFulfillManually({ ...base, autoFulfillBlockedReason: reason })).toBe(false);
    }
  });

  it('refuses a blocked row with no reason', () => {
    expect(canStartAutoFulfillManually({ ...base, autoFulfillBlockedReason: null })).toBe(false);
  });

  it.each([AutoFulfillStatus.FAILED, AutoFulfillStatus.DRY_RUN])('allows %s', (autoFulfillStatus) => {
    expect(canStartAutoFulfillManually({ ...base, autoFulfillStatus, autoFulfillBlockedReason: null })).toBe(true);
  });

  it('allows SKIPPED only without a reason (automation off / no account / over cap)', () => {
    expect(
      canStartAutoFulfillManually({ ...base, autoFulfillStatus: AutoFulfillStatus.SKIPPED, autoFulfillBlockedReason: null })
    ).toBe(true);
    for (const reason of [
      AutoFulfillBlockedReason.ORDER_CANCELLED,
      AutoFulfillBlockedReason.ORDER_NOT_PAID,
      AutoFulfillBlockedReason.ORDER_ALREADY_FULFILLED,
      AutoFulfillBlockedReason.LISTING_OVER_PLAN_LIMIT,
    ]) {
      expect(
        canStartAutoFulfillManually({ ...base, autoFulfillStatus: AutoFulfillStatus.SKIPPED, autoFulfillBlockedReason: reason })
      ).toBe(false);
    }
  });

  it.each([AutoFulfillStatus.PENDING, AutoFulfillStatus.RUNNING, AutoFulfillStatus.PLACED])(
    'refuses %s — a job may be queued or mid-checkout, or it is bought',
    (autoFulfillStatus) => {
      expect(canStartAutoFulfillManually({ ...base, autoFulfillStatus, autoFulfillBlockedReason: null })).toBe(false);
    }
  );

  it('refuses a row with no auto-fulfill status at all', () => {
    expect(canStartAutoFulfillManually({ ...base, autoFulfillStatus: null })).toBe(false);
  });

  it('refuses when a real Amazon order is attached, allows a dry-run placeholder', () => {
    expect(canStartAutoFulfillManually({ ...base, amazonOrderId: '114-1234567-1234567' })).toBe(false);
    expect(
      canStartAutoFulfillManually({
        ...base,
        autoFulfillStatus: AutoFulfillStatus.DRY_RUN,
        autoFulfillBlockedReason: null,
        amazonOrderId: 'SIM-114-1234567-1234567',
      })
    ).toBe(true);
  });

  it.each(Object.values(OrderStatus).filter((s) => s !== OrderStatus.WAITING_SHIPMENT))(
    'refuses eBay status %s — only a paid, unshipped, uncancelled sale is bought',
    (status) => {
      expect(canStartAutoFulfillManually({ ...base, status })).toBe(false);
    }
  );

  it('refuses an untracked order and one over the plan limit', () => {
    expect(canStartAutoFulfillManually({ ...base, isTracked: false })).toBe(false);
    expect(canStartAutoFulfillManually({ ...base, listingOverPlanLimit: true })).toBe(false);
  });
});
