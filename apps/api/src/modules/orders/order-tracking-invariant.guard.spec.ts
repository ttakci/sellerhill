import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.join(__dirname, 'order-sync.service.ts'), 'utf8');

describe('order ingest tracking invariant', () => {
  it('matches only active Zonds listings', () => {
    expect(source).toContain('AND status = $3');
    expect(source).toContain('[lineItem.legacyItemId, userId, ListingStatus.ACTIVE]');
  });

  it('does not attach a listing on conflict re-sync', () => {
    const conflictUpdate = source.slice(
      source.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'),
      source.indexOf('RETURNING id, (xmax = 0) AS inserted')
    );
    expect(conflictUpdate).not.toContain('listing_id =');
  });

  it('gates stock and auto-fulfill on a new tracked listing match', () => {
    expect(source.match(/if \(inserted && listingId && entity\.quantity > 0\)/g)).toHaveLength(2);
  });
});
