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
