import {
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  MANUALLY_RETRYABLE_BLOCKED_REASONS,
  ConfirmNotPurchasedRefusal,
  OrderStatus,
  canStartAutoFulfillManually,
  resolveConfirmNotPurchased,
  type ConfirmNotPurchasedInput,
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

  it('refuses EVERY otherwise-allowed state once the Place Order click was stamped', () => {
    const submittedAt = '2026-10-01T10:00:00Z';
    for (const reason of MANUALLY_RETRYABLE_BLOCKED_REASONS) {
      expect(canStartAutoFulfillManually({ ...base, autoFulfillBlockedReason: reason, submittedAt })).toBe(false);
    }
    for (const autoFulfillStatus of [AutoFulfillStatus.FAILED, AutoFulfillStatus.DRY_RUN, AutoFulfillStatus.SKIPPED]) {
      expect(
        canStartAutoFulfillManually({ ...base, autoFulfillStatus, autoFulfillBlockedReason: null, submittedAt })
      ).toBe(false);
    }
  });

  it('refuses a multi-item order — the checkout buys one line of several', () => {
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: 2 })).toBe(false);
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: 1 })).toBe(true);
    expect(canStartAutoFulfillManually({ ...base, lineItemCount: null })).toBe(true);
  });
});

describe('resolveConfirmNotPurchased', () => {
  const unknown: ConfirmNotPurchasedInput = {
    status: OrderStatus.WAITING_SHIPMENT,
    autoFulfillStatus: AutoFulfillStatus.BLOCKED,
    amazonOrderId: null,
    submittedAt: '2026-10-01T10:00:00Z',
    accountScannedAt: '2026-10-01T10:06:00Z',
  };

  it('allows it only after a scan that finished AFTER the click', () => {
    expect(resolveConfirmNotPurchased(unknown)).toBeNull();
  });

  it('refuses before any scan, and for a scan older than (or equal to) the click', () => {
    for (const accountScannedAt of [null, '2026-10-01T09:59:59Z', '2026-10-01T10:00:00Z', 'not-a-date']) {
      expect(resolveConfirmNotPurchased({ ...unknown, accountScannedAt })).toBe(
        ConfirmNotPurchasedRefusal.NOT_YET_CHECKED
      );
    }
  });

  it('refuses when the order is not in the unknown state', () => {
    const notUnknown: Partial<ConfirmNotPurchasedInput>[] = [
      { submittedAt: null },
      { amazonOrderId: '113-1234567-1234567' },
      { autoFulfillStatus: AutoFulfillStatus.PLACED },
      { autoFulfillStatus: AutoFulfillStatus.RUNNING },
      { autoFulfillStatus: AutoFulfillStatus.PENDING },
      { status: OrderStatus.CANCELLED },
      { status: OrderStatus.SHIPPED },
    ];
    for (const patch of notUnknown) {
      expect(resolveConfirmNotPurchased({ ...unknown, ...patch })).toBe(ConfirmNotPurchasedRefusal.NOT_UNKNOWN);
    }
  });
});
