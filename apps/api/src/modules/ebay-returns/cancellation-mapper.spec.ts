// apps/api/src/modules/ebay-returns/cancellation-mapper.spec.ts

import { mapCancellation } from './cancellation-mapper';

/** A `CancelSummary` shaped like the search page's own sample, buyer-initiated and open. */
const summary = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  cancelId: '5000000123',
  marketplaceId: 'EBAY_US',
  legacyOrderId: '12-34567-89012',
  requestorType: 'BUYER',
  cancelReason: 'BUYER_ASKED_CANCEL',
  cancelState: 'REFUND_PENDING',
  cancelStatus: 'CANCEL_PENDING',
  paymentStatus: 'ONLINE_PAID',
  buyerLoginName: 'a_buyer',
  requestRefundAmount: { value: 41.9, currency: 'usd' },
  cancelRequestDate: { value: '2026-10-06T10:00:00.000Z' },
  sellerResponseDueDate: { value: '2026-10-09T10:00:00.000Z' },
  ...over,
});

describe('mapCancellation', () => {
  it('maps every documented field of an open buyer request', () => {
    expect(mapCancellation(summary())).toEqual({
      cancelId: '5000000123',
      legacyOrderId: '12-34567-89012',
      marketplaceId: 'EBAY_US',
      requestorType: 'BUYER',
      state: 'REFUND_PENDING',
      status: 'CANCEL_PENDING',
      reason: 'BUYER_ASKED_CANCEL',
      closeReason: null,
      buyerLoginName: 'a_buyer',
      requestedAt: '2026-10-06T10:00:00.000Z',
      sellerRespondBy: '2026-10-09T10:00:00.000Z',
      buyerRespondBy: null,
      closedAt: null,
      requestedRefundAmount: 41.9,
      currency: 'USD',
      paymentStatus: 'ONLINE_PAID',
    });
  });

  it('maps a closed request with its close date and reason (the reference sample)', () => {
    const row = mapCancellation(
      summary({
        cancelState: 'CLOSED',
        cancelStatus: 'CANCEL_CLOSED_FOR_COMMITMENT',
        cancelCloseReason: 'SELLER_APPROVE_TIMEOUT_UNPAID',
        cancelCloseDate: { value: '2015-05-30T06:25:48.000Z' },
      })
    );
    expect(row?.closedAt).toBe('2015-05-30T06:25:48.000Z');
    expect(row?.closeReason).toBe('SELLER_APPROVE_TIMEOUT_UNPAID');
  });

  it('carries an unknown enum value as sent, never dropped', () => {
    expect(mapCancellation(summary({ cancelStatus: 'A_FUTURE_VALUE' }))?.status).toBe('A_FUTURE_VALUE');
  });

  it('reads the detail container the same way (same field names)', () => {
    const row = mapCancellation({ ...summary(), activityHistories: [{ activityType: 'BUYER_CREATE_CANCEL' }] });
    expect(row?.cancelId).toBe('5000000123');
  });

  it('is null without a cancelId, and for anything that is not an object', () => {
    expect(mapCancellation(summary({ cancelId: undefined }))).toBeNull();
    expect(mapCancellation(summary({ cancelId: '  ' }))).toBeNull();
    expect(mapCancellation(null)).toBeNull();
    expect(mapCancellation('x')).toBeNull();
    expect(mapCancellation([summary()])).toBeNull();
  });

  it('never throws on malformed fields — they map to null', () => {
    const row = mapCancellation(
      summary({
        cancelRequestDate: { value: 'not a date' },
        sellerResponseDueDate: 'flat',
        requestRefundAmount: { value: 'abc', currency: 'DOLLARS' },
        requestorType: 7,
      })
    );
    expect(row).toMatchObject({
      requestedAt: null,
      sellerRespondBy: null,
      requestedRefundAmount: null,
      currency: null,
      requestorType: '7',
    });
  });
});
