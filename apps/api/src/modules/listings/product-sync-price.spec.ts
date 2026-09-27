import { Logger } from '@nestjs/common';
import type { ProductData } from '@repo/shared';
import axios from 'axios';

import { EbayBulkService } from '../ebay/ebay-bulk.service';

import { ProductSyncService } from './product-sync.service';

/**
 * A stored Amazon price of 0 means "unknown", never "free". The fan-out must
 * never send a price derived from it (that is the fee floor, a loss on every
 * order) — but it must still push the QUANTITY, or a listing whose product ran
 * out on Amazon would stay live at its old quantity and oversell. The listing's
 * price and profit figures stay exactly what they were.
 */
describe('ProductSyncService — source price unknown (stored 0)', () => {
  const listingRow = {
    id: 'listing-1',
    user_id: 'user-1',
    listing_settings_group_id: 'group-1',
    ebay_item_id: '1234',
    ebay_account_id: 'account-1',
    sku: 'B0C1HJV7BJ-NEW',
    ebay_offer_id: 'offer-1',
    price: '25.00',
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

  /** What the strategy returns for a price of 0: the fee floor. */
  const floorPricing = (quantity: number) => ({
    price: 0.99, quantity, purchasePrice: 0, estimatedProfit: 0.5, profitMargin: 50, roi: 0,
  });

  function build(current: number, quantity: number) {
    const query = jest.fn().mockResolvedValueOnce([listingRow]).mockResolvedValue([]);
    const strategy = {
      getSettingsGroup: jest.fn().mockResolvedValue({}),
      computePricing: jest.fn().mockResolvedValue(
        current > 0
          ? { price: 30, quantity, purchasePrice: 20, estimatedProfit: 5, profitMargin: 16, roi: 25 }
          : floorPricing(quantity),
      ),
    };
    const bulk = {
      updatePriceQuantity: jest.fn((_account: string, items: Array<{ listingId: string; offerId: string | null; price: number | null }>) =>
        Promise.resolve(items.map((item) => ({ listingId: item.listingId, ok: true, offerId: item.offerId }))),
      ),
    };
    const service = new ProductSyncService(
      { query } as never,
      strategy as never,
      { resolveListingAccountId: jest.fn().mockResolvedValue('account-1') } as never,
      bulk as never,
      {
        getProductByAsin: jest.fn().mockResolvedValue({
          id: 'product-1',
          data: { asin: 'B0C1HJV7BJ', price: { current, currency: 'USD' }, stock: quantity } as unknown as ProductData,
        }),
      } as never,
      { getResolvedSettings: jest.fn().mockResolvedValue({ amazonTaxRate: 0 }) } as never,
    );
    return { service, strategy, bulk, query };
  }

  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it.each([0, Number.NaN, -1])('price %p going out of stock: quantity 0 IS pushed, with no price', async (price) => {
    const { service, bulk } = build(price, 0);

    const pending = await service.computePendingUpdates('product-1', 'B0C1HJV7BJ');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ quantity: 0, quantityOnly: true, price: 25 });

    await service.flushUpdates(pending);
    const [, items] = bulk.updatePriceQuantity.mock.calls[0];
    expect(items).toEqual([expect.objectContaining({ listingId: 'listing-1', quantity: 0, price: null })]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('price unknown — quantity synced, price left as is'));
  });

  it('never sends a price computed from 0, and stored profit figures are untouched', async () => {
    const { service, bulk, query } = build(0, 0);
    await service.flushUpdates(await service.computePendingUpdates('product-1', 'B0C1HJV7BJ'));

    // Nothing sent carries the floor price.
    for (const [, items] of bulk.updatePriceQuantity.mock.calls) {
      for (const item of items) {
        expect(item.price).toBeNull();
      }
    }
    // The only listing write sets quantity (and identifiers) — never a priced column.
    const writes = query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => /UPDATE listings/.test(sql));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatch(/SET quantity = v\.quantity/);
    expect(writes[0]).not.toMatch(/\bprice =|purchase_price|estimated_profit|profit_margin|\broi\b/);
  });

  it('a quantity that did not move is not pushed, whatever the floor price would have been', async () => {
    const { service, bulk } = build(0, 3);
    const pending = await service.computePendingUpdates('product-1', 'B0C1HJV7BJ');
    expect(pending).toEqual([]);
    await service.flushUpdates(pending);
    expect(bulk.updatePriceQuantity).not.toHaveBeenCalled();
  });

  it('a product with a real price is repriced as before', async () => {
    const { service } = build(10, 3);
    const pending = await service.computePendingUpdates('product-1', 'B0C1HJV7BJ');
    expect(pending[0]).toMatchObject({ price: 30, quantity: 3, quantityOnly: false });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('EbayBulkService.updatePriceQuantity — quantity-only item', () => {
  it('sends the offer with availableQuantity and NO price when price is null', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: { responses: [{ sku: 'S1', statusCode: 200 }] } });
    const service = new EbayBulkService(
      { get: jest.fn().mockReturnValue('https://api.example') } as never,
      {
        getAccountApiContext: jest.fn().mockResolvedValue({ accessToken: 't', currency: 'USD', contentLanguage: 'en-US' }),
      } as never,
      { acquire: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );

    await service.updatePriceQuantity('account-1', [
      { listingId: 'l1', sku: 'S1', offerId: 'o1', price: null, quantity: 0 },
    ]);

    const body = post.mock.calls[0][1] as { requests: Array<{ offers: Array<Record<string, unknown>> }> };
    expect(body.requests[0].offers[0]).toEqual({ offerId: 'o1', availableQuantity: 0 });
    post.mockRestore();
  });
});
