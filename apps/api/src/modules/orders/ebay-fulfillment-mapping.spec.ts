import type { ConfigService } from '@nestjs/config';

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
});
