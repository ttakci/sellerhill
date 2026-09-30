import type { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@repo/shared';

import type { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { EbayFulfillmentService } from './ebay-fulfillment.service';

const service = new EbayFulfillmentService({} as ConfigService, {} as EbayCallBudgetService);

const money = (value: string) => ({ value, currency: 'USD' });

// Shaped like a real getOrders payload for a Collect & Remit order: the tax is
// only on the line item, pricingSummary.tax is a flat 0, and the ship-to sits
// under fulfillmentStartInstructions rather than a `shippingDetail` object.
const collectAndRemitOrder = {
  orderId: '03-15198-29781',
  pricingSummary: {
    priceSubtotal: money('11.47'),
    deliveryCost: money('0.00'),
    tax: money('0.00'),
    total: money('11.47'),
  },
  paymentSummary: { totalDueSeller: money('9.63') },
  totalMarketplaceFee: money('1.84'),
  lineItems: [{ ebayCollectAndRemitTaxes: [{ amount: money('1.06') }] }],
  fulfillmentStartInstructions: [
    {
      shippingStep: {
        shipTo: {
          fullName: 'Eleazar Sanchez',
          primaryPhone: { phoneNumber: '+18653842581' },
          contactAddress: {
            addressLine1: '4934 Raccoon Valley Dr',
            city: 'Knoxville',
            stateOrProvince: 'TN',
            postalCode: '37938-1741',
            countryCode: 'US',
          },
        },
      },
    },
  ],
};

describe('EbayFulfillmentService.mapEbayOrderToEntity', () => {
  const map = (order: object) =>
    service.mapEbayOrderToEntity(order as never, 'user-1', 'acct-1');

  it('reads the ship-to address from fulfillmentStartInstructions', () => {
    const entity = map(collectAndRemitOrder);
    expect(entity.shippingAddress).toMatchObject({
      fullName: 'Eleazar Sanchez',
      street: '4934 Raccoon Valley Dr',
      city: 'Knoxville',
      state: 'TN',
      zipCode: '37938-1741',
      country: 'US',
      phone: '+18653842581',
    });
  });

  it('still reads the legacy shippingDetail path when that is all there is', () => {
    const entity = map({
      orderId: 'x',
      shippingDetail: { shipToAddress: { fullName: 'A', contactAddress: { addressLine1: '1 Main', city: 'C' } } },
    });
    expect(entity.shippingAddress).toMatchObject({ fullName: 'A', street: '1 Main', city: 'C' });
  });

  it('falls back to the line-item Collect & Remit tax when pricingSummary.tax is 0', () => {
    const entity = map(collectAndRemitOrder);
    expect(entity.saleTax).toBe(1.06);
    expect(entity.saleTotal).toBeCloseTo(12.53, 2);
    expect(entity.ebayCollectRemitTax).toBe(1.06);
  });

  it('leaves the totals alone when pricingSummary already carries the tax', () => {
    const entity = map({
      ...collectAndRemitOrder,
      pricingSummary: { ...collectAndRemitOrder.pricingSummary, tax: money('1.06'), total: money('12.53') },
    });
    expect(entity.saleTax).toBe(1.06);
    expect(entity.saleTotal).toBeCloseTo(12.53, 2);
  });

  it('never touches ebayEarnings, which already excludes the tax', () => {
    expect(map(collectAndRemitOrder).ebayEarnings).toBe(9.63);
  });

  // Shapes observed on real production orders (2026-09-30).
  it('maps a cancelled order to CANCELLED whatever its fulfilment status says', () => {
    const entity = map({
      ...collectAndRemitOrder,
      orderFulfillmentStatus: 'NOT_STARTED',
      orderPaymentStatus: 'FULLY_REFUNDED',
      cancelStatus: { cancelState: 'CANCELED', cancelledDate: '2026-09-20T10:00:00.000Z', cancelRequests: [] },
      paymentSummary: {
        totalDueSeller: money('0.00'),
        refunds: [{ amount: money('9.63'), refundDate: '2026-09-20T10:00:05.000Z', refundStatus: 'REFUNDED' }],
      },
    });
    expect(entity.status).toBe(OrderStatus.CANCELLED);
    expect(entity.ebayCancelState).toBe('CANCELED');
    expect(entity.ebayCancelledAt?.toISOString()).toBe('2026-09-20T10:00:00.000Z');
    expect(entity.ebayRefundedAmount).toBe(9.63);
    expect(entity.ebayRefundedAt?.toISOString()).toBe('2026-09-20T10:00:05.000Z');
  });

  it('keeps an ordinary paid order out of CANCELLED and reports no refund', () => {
    const entity = map({
      ...collectAndRemitOrder,
      orderFulfillmentStatus: 'NOT_STARTED',
      orderPaymentStatus: 'PAID',
      cancelStatus: { cancelState: 'NONE_REQUESTED', cancelRequests: [] },
      paymentSummary: { totalDueSeller: money('9.63'), refunds: [] },
    });
    expect(entity.status).toBe(OrderStatus.WAITING_SHIPMENT);
    expect(entity.ebayCancelState).toBe('NONE_REQUESTED');
    expect(entity.ebayCancelledAt).toBeNull();
    expect(entity.ebayRefundedAmount).toBeNull();
    expect(entity.ebayRefundedAt).toBeNull();
  });

  it('a refund without a cancellation does not cancel the order', () => {
    const entity = map({
      ...collectAndRemitOrder,
      orderFulfillmentStatus: 'FULFILLED',
      orderPaymentStatus: 'FULLY_REFUNDED',
      cancelStatus: { cancelState: 'NONE_REQUESTED', cancelRequests: [] },
      paymentSummary: {
        totalDueSeller: money('0.00'),
        refunds: [{ amount: money('9.63'), refundDate: '2026-09-25T08:00:00.000Z', refundStatus: 'REFUNDED' }],
      },
    });
    expect(entity.status).not.toBe(OrderStatus.CANCELLED);
    expect(entity.ebayRefundedAmount).toBe(9.63);
  });
});
