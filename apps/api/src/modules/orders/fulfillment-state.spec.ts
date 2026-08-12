import {
  AutoFulfillStatus,
  OrderFulfillmentState,
  OrderStatus,
  deriveFulfillmentState,
  isActionableFulfillmentState,
  isSimulatedAmazonOrderId,
} from '@repo/shared';

const base = { status: OrderStatus.WAITING_SHIPMENT };

describe('deriveFulfillmentState', () => {
  it('reports a placed order as purchased', () => {
    expect(
      deriveFulfillmentState({
        ...base,
        autoFulfillStatus: AutoFulfillStatus.PLACED,
        amazonOrderId: '123-4567890-1234567',
      }),
    ).toBe(OrderFulfillmentState.PURCHASED);
  });

  it('lets an Amazon cancellation outrank a placed order', () => {
    // The money moved, the item is not coming, and the eBay sale is still owed —
    // the most urgent state, so it must win over `placed`.
    expect(
      deriveFulfillmentState({
        ...base,
        autoFulfillStatus: AutoFulfillStatus.PLACED,
        amazonOrderId: '123-4567890-1234567',
        amazonCancelledAt: '2026-07-30T00:00:00Z',
      }),
    ).toBe(OrderFulfillmentState.AMAZON_CANCELLED);
  });

  it('never lets a simulated order look purchased', () => {
    expect(
      deriveFulfillmentState({
        ...base,
        autoFulfillStatus: AutoFulfillStatus.PLACED,
        amazonOrderId: 'SIM-123-4567890-1234567',
        isSimulated: true,
      }),
    ).toBe(OrderFulfillmentState.SIMULATED);
  });

  it('maps blocked and failed to action required', () => {
    expect(
      deriveFulfillmentState({ ...base, autoFulfillStatus: AutoFulfillStatus.BLOCKED }),
    ).toBe(OrderFulfillmentState.ACTION_REQUIRED);
    expect(
      deriveFulfillmentState({ ...base, autoFulfillStatus: AutoFulfillStatus.FAILED }),
    ).toBe(OrderFulfillmentState.ACTION_REQUIRED);
  });

  it('treats queued and running as in progress', () => {
    expect(
      deriveFulfillmentState({ ...base, autoFulfillStatus: AutoFulfillStatus.PENDING }),
    ).toBe(OrderFulfillmentState.IN_PROGRESS);
    expect(
      deriveFulfillmentState({ ...base, autoFulfillStatus: AutoFulfillStatus.RUNNING }),
    ).toBe(OrderFulfillmentState.IN_PROGRESS);
  });

  it('calls a skipped order manual once the seller bought it themselves', () => {
    expect(
      deriveFulfillmentState({
        ...base,
        autoFulfillStatus: AutoFulfillStatus.SKIPPED,
        amazonOrderId: '123-4567890-1234567',
      }),
    ).toBe(OrderFulfillmentState.MANUAL);
    expect(
      deriveFulfillmentState({ ...base, autoFulfillStatus: AutoFulfillStatus.SKIPPED }),
    ).toBe(OrderFulfillmentState.NOT_AUTOMATED);
  });

  it('reports a manual Amazon link with no automation record', () => {
    expect(
      deriveFulfillmentState({ ...base, amazonOrderId: '123-4567890-1234567' }),
    ).toBe(OrderFulfillmentState.MANUAL);
  });

  it('reports an untouched order as not automated', () => {
    expect(deriveFulfillmentState(base)).toBe(OrderFulfillmentState.NOT_AUTOMATED);
  });

  it('treats an already-shipped order as manually handled', () => {
    expect(deriveFulfillmentState({ status: OrderStatus.SHIPPED })).toBe(
      OrderFulfillmentState.MANUAL,
    );
  });

  describe('a settled sale is never action-required', () => {
    // There is no acknowledge flag on an order, so a completed eBay sale is the
    // only evidence the platform has that the seller resolved whatever went
    // wrong on the Amazon side. Without these two rules an order fixed by hand
    // stayed in the "needs you" bucket forever and the Action Center badge
    // could never reach zero.
    it('reports a completed sale as manual even after an Amazon cancellation', () => {
      expect(
        deriveFulfillmentState({
          status: OrderStatus.COMPLETED,
          amazonOrderId: '123-4567890-1234567',
          amazonCancelledAt: '2026-07-30T00:00:00Z',
        }),
      ).toBe(OrderFulfillmentState.MANUAL);
    });

    it('reports a completed sale as manual even after a blocked checkout', () => {
      expect(
        deriveFulfillmentState({
          status: OrderStatus.COMPLETED,
          autoFulfillStatus: AutoFulfillStatus.BLOCKED,
        }),
      ).toBe(OrderFulfillmentState.MANUAL);
      expect(
        deriveFulfillmentState({
          status: OrderStatus.COMPLETED,
          autoFulfillStatus: AutoFulfillStatus.FAILED,
        }),
      ).toBe(OrderFulfillmentState.MANUAL);
    });

    it('does NOT treat shipped as settled — the parcel has not arrived', () => {
      // An Amazon cancellation after the tracking push is the worst case there
      // is: eBay has a tracking number for a parcel nobody is sending.
      expect(
        deriveFulfillmentState({
          status: OrderStatus.SHIPPED,
          amazonCancelledAt: '2026-07-30T00:00:00Z',
        }),
      ).toBe(OrderFulfillmentState.AMAZON_CANCELLED);
      expect(
        deriveFulfillmentState({
          status: OrderStatus.SHIPPED,
          autoFulfillStatus: AutoFulfillStatus.BLOCKED,
        }),
      ).toBe(OrderFulfillmentState.ACTION_REQUIRED);
    });

    it('still reports an open sale as needing action', () => {
      expect(
        deriveFulfillmentState({
          ...base,
          amazonCancelledAt: '2026-07-30T00:00:00Z',
        }),
      ).toBe(OrderFulfillmentState.AMAZON_CANCELLED);
    });
  });
});

describe('isActionableFulfillmentState', () => {
  it('flags exactly the states a seller must act on', () => {
    expect(isActionableFulfillmentState(OrderFulfillmentState.ACTION_REQUIRED)).toBe(true);
    expect(isActionableFulfillmentState(OrderFulfillmentState.AMAZON_CANCELLED)).toBe(true);
    expect(isActionableFulfillmentState(OrderFulfillmentState.PURCHASED)).toBe(false);
    expect(isActionableFulfillmentState(OrderFulfillmentState.IN_PROGRESS)).toBe(false);
    expect(isActionableFulfillmentState(OrderFulfillmentState.NOT_AUTOMATED)).toBe(false);
    expect(isActionableFulfillmentState(OrderFulfillmentState.SIMULATED)).toBe(false);
  });
});

describe('isSimulatedAmazonOrderId', () => {
  it('recognizes the dry-run placeholder and nothing else', () => {
    expect(isSimulatedAmazonOrderId('SIM-123-4567890-1234567')).toBe(true);
    expect(isSimulatedAmazonOrderId('123-4567890-1234567')).toBe(false);
    expect(isSimulatedAmazonOrderId(null)).toBe(false);
    expect(isSimulatedAmazonOrderId(undefined)).toBe(false);
  });
});
