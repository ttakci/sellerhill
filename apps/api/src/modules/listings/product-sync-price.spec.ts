import { Logger } from '@nestjs/common';
import type { ProductData } from '@repo/shared';

import { ProductSyncService } from './product-sync.service';

/**
 * A stored Amazon price of 0 never reaches eBay through the price/stock
 * fan-out: pricing from 0 returns the fee floor, so the listing would be sold
 * at a loss on every order. The whole product is skipped, logged once.
 */
describe('ProductSyncService.computePendingUpdates — non-positive source price', () => {
  const listingRow = {
    id: 'listing-1',
    user_id: 'user-1',
    listing_settings_group_id: 'group-1',
    ebay_item_id: '1234',
    ebay_account_id: 'account-1',
    sku: 'B0C1HJV7BJ-NEW',
    ebay_offer_id: 'offer-1',
    price: 25,
    quantity: 3,
    disable_ordering: false,
    disable_repricing: false,
    lock_price: false,
    lock_quantity: false,
    price_override: null,
    quantity_override: null,
    margin_percent_override: null,
    margin_fixed_override: null,
  };

  function build(current: number) {
    const strategy = { getSettingsGroup: jest.fn(), computePricing: jest.fn() };
    const service = new ProductSyncService(
      { query: jest.fn().mockResolvedValue([listingRow, { ...listingRow, id: 'listing-2' }]) } as never,
      strategy as never,
      { resolveListingAccountId: jest.fn() } as never,
      {} as never,
      {
        getProductByAsin: jest.fn().mockResolvedValue({
          id: 'product-1',
          data: { asin: 'B0C1HJV7BJ', price: { current, currency: 'USD' }, stock: 20 } as unknown as ProductData,
        }),
      } as never,
      { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never,
    );
    return { service, strategy };
  }

  it.each([0, Number.NaN, -1])('skips every listing of a product priced %p, warning once', async (price) => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, strategy } = build(price);

    await expect(service.computePendingUpdates('product-1', 'B0C1HJV7BJ')).resolves.toEqual([]);
    expect(strategy.computePricing).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('still recomputes a product with a real price', async () => {
    const { service, strategy } = build(10);
    strategy.getSettingsGroup.mockResolvedValue({});
    strategy.computePricing.mockResolvedValue({
      price: 25, quantity: 3, purchasePrice: 10, estimatedProfit: 5, profitMargin: 20, roi: 50,
    });

    await service.computePendingUpdates('product-1', 'B0C1HJV7BJ');
    expect(strategy.computePricing).toHaveBeenCalledTimes(2);
  });
});
