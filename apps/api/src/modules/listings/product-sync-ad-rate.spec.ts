import { readFileSync } from 'fs';
import { join } from 'path';

import type { ProductData } from '@repo/shared';

import { ProductSyncService } from './product-sync.service';


describe('the fan-out prices each listing with its OWN applied ad rate', () => {
  const src = readFileSync(join(__dirname, 'product-sync.service.ts'), 'utf8');
  it('selects ad_rate_applied per listing row', () => {
    const select = src.slice(src.indexOf('async computePendingUpdates('), src.indexOf('if (listings.length === 0)'));
    expect(select).toMatch(/ad_rate_applied/);
  });
  it('passes the row rate into computePricing', () => {
    const body = src.slice(src.indexOf('private async buildPendingUpdate('));
    expect(body).toMatch(/computePricing\([\s\S]*?Number\(listing\.ad_rate_applied\)/);
  });
});

describe('computePendingUpdates passes each listing its own ad rate (behaviour)', () => {
  const row = (id: string, adRate: string | null) => ({
    id,
    user_id: 'user-1',
    listing_settings_group_id: 'group-1',
    ebay_item_id: `item-${id}`,
    ebay_account_id: 'account-1',
    sku: `SKU-${id}`,
    ebay_offer_id: `offer-${id}`,
    price: '25.00',
    quantity: 3,
    ad_rate_applied: adRate,
    disable_ordering: false,
    disable_repricing: false,
    lock_price: false,
    lock_quantity: false,
    price_override: null,
    quantity_override: null,
    margin_percent_override: null,
    margin_fixed_override: null,
  });

  it('gives computePricing 5 for a promoted row and 0 for a NULL one', async () => {
    const computePricing = jest
      .fn()
      .mockResolvedValue({ price: 30, quantity: 3, purchasePrice: 20, estimatedProfit: 5, profitMargin: 16, roi: 25 });
    const service = new ProductSyncService(
      { query: jest.fn().mockResolvedValueOnce([row('a', '5'), row('b', null)]).mockResolvedValue([]) } as never,
      { getSettingsGroup: jest.fn().mockResolvedValue({}), computePricing } as never,
      { resolveListingAccountId: jest.fn().mockResolvedValue('account-1') } as never,
      {} as never,
      {
        getProductByAsin: jest.fn().mockResolvedValue({
          id: 'product-1',
          data: { asin: 'B0C1HJV7BJ', price: { current: 10, currency: 'USD' }, stock: 3 } as unknown as ProductData,
        }),
      } as never,
      { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never
    );

    await service.computePendingUpdates('product-1', 'B0C1HJV7BJ');

    expect(computePricing).toHaveBeenCalledTimes(2);
    const calls = computePricing.mock.calls as unknown[][];
    expect(calls[0][5]).toBe(5);
    expect(calls[1][5]).toBe(0);
  });
});
