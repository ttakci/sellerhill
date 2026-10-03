import { ListingsService } from './listings.service';

/**
 * Ending a listing goes through the store it was published on. It used to take
 * the token of an arbitrary active store, so ending a second store's listing
 * went out with the first store's token and failed.
 */
describe('endListings — the listing’s own store', () => {
  function build(row: { ebay_item_id: string; ebay_account_id: string | null }, fallback: string | null = 'store-a') {
    const db = {
      query: jest.fn((sql: string) => Promise.resolve(/SELECT ebay_item_id, ebay_account_id/.test(sql) ? [row] : [])),
    };
    const ebay = {
      resolveListingAccountId: jest.fn((_userId: string, accountId: string | null) =>
        Promise.resolve(accountId ?? fallback)
      ),
      withdrawOffer: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ListingsService(db as never, ebay as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    return { service, ebay };
  }

  it('ends the item through the account stored on the listing', async () => {
    const { service, ebay } = build({ ebay_item_id: '111', ebay_account_id: 'store-b' });
    await expect(service.endListings('user-1', ['listing-1'])).resolves.toBe(1);
    expect(ebay.withdrawOffer).toHaveBeenCalledWith('user-1', 'store-b', '111');
  });

  it('resolves a legacy listing with no store deterministically', async () => {
    const { service, ebay } = build({ ebay_item_id: '222', ebay_account_id: null });
    await service.endListings('user-1', ['listing-1']);
    expect(ebay.resolveListingAccountId).toHaveBeenCalledWith('user-1', null);
    expect(ebay.withdrawOffer).toHaveBeenCalledWith('user-1', 'store-a', '222');
  });

  it('ends nothing when no active store can be resolved', async () => {
    const { service, ebay } = build({ ebay_item_id: '333', ebay_account_id: null }, null);
    await expect(service.endListings('user-1', ['listing-1'])).resolves.toBe(0);
    expect(ebay.withdrawOffer).not.toHaveBeenCalled();
  });
});
