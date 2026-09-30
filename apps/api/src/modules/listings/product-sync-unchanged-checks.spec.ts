import { ListingStatus } from '@repo/shared';

import { ProductSyncService } from './product-sync.service';

/**
 * A refresh that verified a product but moved nothing must still leave a trace
 * in the listing's Revisions drawer ("checked, unchanged"), otherwise a run
 * with no change is indistinguishable from a run that was skipped.
 */
describe('ProductSyncService.recordUnchangedChecks', () => {
  function build() {
    const query = jest.fn().mockResolvedValue([]);
    const service = new ProductSyncService(
      { query } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    return { service, query };
  }

  it('writes nothing when no product was checked', async () => {
    const { service, query } = build();
    await service.recordUnchangedChecks([], ['listing-1']);
    expect(query).not.toHaveBeenCalled();
  });

  it('inserts previous = new from the listing itself, for active in-plan listings only', async () => {
    const { service, query } = build();
    await service.recordUnchangedChecks(['product-1'], ['listing-pushed']);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('INSERT INTO listing_revisions');
    expect(sql).toContain('SELECT l.id, l.price, l.price, l.quantity, l.quantity');
    expect(sql).toContain('l.over_plan_limit = FALSE');
    expect(sql).toContain('NOT (l.id = ANY($3::uuid[]))');
    expect(params).toEqual([['product-1'], ListingStatus.ACTIVE, ['listing-pushed']]);
  });
});
