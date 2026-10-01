import { findFulfillmentForLineItem } from './existing-fulfillment';

describe('findFulfillmentForLineItem', () => {
  it('is null when eBay holds no fulfillment', () => {
    expect(findFulfillmentForLineItem([], 'line-1')).toBeNull();
    expect(findFulfillmentForLineItem(null, 'line-1')).toBeNull();
    expect(findFulfillmentForLineItem(undefined, 'line-1')).toBeNull();
  });

  it('finds the fulfillment that names the line item', () => {
    const ours = {
      fulfillmentId: 'f-2',
      lineItems: [{ lineItemId: 'line-1', quantity: 1 }],
      shipmentTrackingNumber: 'AQUAA0359110926YQ',
      shippingCarrierCode: 'AQUILINE',
    };
    const found = findFulfillmentForLineItem(
      [{ fulfillmentId: 'f-1', lineItems: [{ lineItemId: 'other-line', quantity: 1 }] }, ours],
      'line-1'
    );
    expect(found).toBe(ours);
  });

  it('does not take another line item’s fulfillment for ours', () => {
    expect(
      findFulfillmentForLineItem([{ fulfillmentId: 'f-1', lineItems: [{ lineItemId: 'other-line' }] }], 'line-1')
    ).toBeNull();
  });

  it('counts a fulfillment that lists no line items — the order was shipped', () => {
    const bare = { fulfillmentId: 'f-1' };
    expect(findFulfillmentForLineItem([bare], 'line-1')).toBe(bare);
    const empty = { fulfillmentId: 'f-2', lineItems: [] };
    expect(findFulfillmentForLineItem([empty], 'line-1')).toBe(empty);
  });
});
