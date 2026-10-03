// apps/api/src/modules/orders/ebay-fulfillment-visibility.spec.ts
//
// A 404 on `GET /order/{id}/shipping_fulfillment` was read as "no fulfillment
// yet". That is also what eBay answers when the order is not visible to the
// token at all — an order filed under the wrong store. The processor then
// bought a paid Aquiline conversion and failed every push. A 404 is now
// checked against the order itself with the same token before it may mean
// "none".

import { ConfigService } from '@nestjs/config';
import { EbayMarketplaceId } from '@repo/shared';
import axios from 'axios';

import type { EbayCallBudgetService } from '../../common/ebay-budget/ebay-call-budget.service';

import { EbayFulfillmentService, EbayOrderNotVisibleError } from './ebay-fulfillment.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function notFound(): Error {
  return Object.assign(new Error('Request failed with status code 404'), { response: { status: 404 } });
}

function build() {
  const config = { get: jest.fn(() => 'https://api.ebay.test') } as unknown as ConfigService;
  const acquire = jest.fn().mockResolvedValue(undefined);
  const budget = { acquire } as unknown as EbayCallBudgetService;
  return { service: new EbayFulfillmentService(config, budget), acquire };
}

describe('EbayFulfillmentService.fetchShippingFulfillments — a 404 is checked, not assumed', () => {
  beforeEach(() => mockedAxios.get.mockReset());

  it('returns the fulfillments eBay reports', async () => {
    const { service } = build();
    mockedAxios.get.mockResolvedValueOnce({ data: { fulfillments: [{ fulfillmentId: 'f-1' }] } });

    await expect(service.fetchShippingFulfillments('token', '03-1', EbayMarketplaceId.EBAY_US)).resolves.toEqual([
      { fulfillmentId: 'f-1' },
    ]);
    expect(mockedAxios.get.mock.calls).toHaveLength(1);
  });

  it('reads a 404 as "none yet" only when the order itself is visible to this token', async () => {
    const { service, acquire } = build();
    mockedAxios.get
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ data: { orderId: '03-1', lineItems: [{ lineItemId: 'li-1' }] } });

    await expect(service.fetchShippingFulfillments('token', '03-1', EbayMarketplaceId.EBAY_US)).resolves.toEqual([]);

    expect(mockedAxios.get.mock.calls).toHaveLength(2);
    expect(mockedAxios.get.mock.calls[1][0]).toBe('https://api.ebay.test/sell/fulfillment/v1/order/03-1');
    const headers = (mockedAxios.get.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer token');
    // Both reads are budget-governed.
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('throws EbayOrderNotVisibleError when the order is not found for this store', async () => {
    const { service } = build();
    mockedAxios.get.mockRejectedValueOnce(notFound()).mockRejectedValueOnce(notFound());

    await expect(service.fetchShippingFulfillments('token', '03-1', EbayMarketplaceId.EBAY_US)).rejects.toBeInstanceOf(
      EbayOrderNotVisibleError
    );
  });

  it('propagates a failure of the visibility read — "could not read" is not "none"', async () => {
    const { service } = build();
    mockedAxios.get
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { response: { status: 503 } }));

    await expect(service.fetchShippingFulfillments('token', '03-1', EbayMarketplaceId.EBAY_US)).rejects.toThrow('boom');
  });

  it('propagates any other failure of the fulfillment read', async () => {
    const { service } = build();
    mockedAxios.get.mockRejectedValueOnce(Object.assign(new Error('ETIMEDOUT'), { response: undefined }));

    await expect(service.fetchShippingFulfillments('token', '03-1', EbayMarketplaceId.EBAY_US)).rejects.toThrow('ETIMEDOUT');
    expect(mockedAxios.get.mock.calls).toHaveLength(1);
  });
});
