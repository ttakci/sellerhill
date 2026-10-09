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

  it('refuses every other blocked reason when no click was stamped', () => {
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
      AutoFulfillBlockedReason.MULTI_ITEM_ORDER,
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

  describe('a purchase not confirmed (the Place Order click was stamped)', () => {
    const submittedAt = '2026-10-01T10:00:00Z';
    const unconfirmed: ManualAutoFulfillInput = {
      ...base,
      autoFulfillBlockedReason: AutoFulfillBlockedReason.NO_CONFIRMATION,
      submittedAt,
    };

    it('lets the seller start it again — whatever the status and reason say', () => {
      expect(canStartAutoFulfillManually(unconfirmed)).toBe(true);
      expect(
        canStartAutoFulfillManually({ ...unconfirmed, autoFulfillBlockedReason: AutoFulfillBlockedReason.INTERRUPTED })
      ).toBe(true);
      for (const autoFulfillStatus of [AutoFulfillStatus.FAILED, AutoFulfillStatus.SKIPPED, AutoFulfillStatus.DRY_RUN]) {
        expect(canStartAutoFulfillManually({ ...unconfirmed, autoFulfillStatus, autoFulfillBlockedReason: null })).toBe(
          true
        );
      }
    });

    it('refuses while a scan saw a matching Amazon order', () => {
      expect(canStartAutoFulfillManually({ ...unconfirmed, suspectOnAmazon: true })).toBe(false);
    });

    it('refuses while a job may be queued or mid-checkout, and once it is placed', () => {
      for (const autoFulfillStatus of [AutoFulfillStatus.PENDING, AutoFulfillStatus.RUNNING, AutoFulfillStatus.PLACED]) {
        expect(canStartAutoFulfillManually({ ...unconfirmed, autoFulfillStatus })).toBe(false);
      }
    });

    it('still refuses a real Amazon order, a settled sale, an untracked or multi-item order', () => {
      expect(canStartAutoFulfillManually({ ...unconfirmed, amazonOrderId: '113-1234567-1234567' })).toBe(false);
      expect(canStartAutoFulfillManually({ ...unconfirmed, status: OrderStatus.CANCELLED })).toBe(false);
      expect(canStartAutoFulfillManually({ ...unconfirmed, status: OrderStatus.SHIPPED })).toBe(false);
      expect(canStartAutoFulfillManually({ ...unconfirmed, isTracked: false })).toBe(false);
      expect(canStartAutoFulfillManually({ ...unconfirmed, lineItemCount: 2 })).toBe(false);
    });
  });

  it('refuses a multi-item order — the checkout buys one line of several', () => {
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: 2 })).toBe(false);
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: 1 })).toBe(true);
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: null })).toBe(true);
  });
});
