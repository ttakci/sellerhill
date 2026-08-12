import fs from 'fs';
import path from 'path';

// Normalized to LF — the repo is checked out with CRLF on Windows and these
// assertions pin multi-line shapes.
const source = fs
  .readFileSync(path.join(__dirname, 'order-sync.service.ts'), 'utf8')
  .replace(/\r\n/g, '\n');

describe('order ingest tracking invariant', () => {
  it('matches only active SellerHill listings', () => {
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

  it('gates every one-time side effect on a new tracked listing match', () => {
    // Each of these must fire only on the genuine insert of an order matched to
    // one of our ACTIVE listings. Re-running any of them on a re-sync would
    // double-deplete shared product stock, inflate sold_count, or — worst —
    // purchase the same order on Amazon twice.
    const GATE = 'if (inserted && listingId && entity.quantity > 0) {';
    // Matched as call sites, not bare names: each of these is also mentioned in
    // a nearby comment, and a comment must not be able to satisfy this guard.
    const sideEffects = [
      'this.productsService.decrementStock(', // sale-driven stock sync
      'SET sold_count = sold_count +', // real-time sold count
      'this.maybeEnqueueAutoFulfill(', // A2 auto purchase
    ];

    for (const effect of sideEffects) {
      const at = source.indexOf(effect);
      expect(at).toBeGreaterThan(-1);

      // Walk the nearest preceding gate to its matching `}` by counting braces,
      // then assert the effect falls inside that span. Brace counting is what
      // makes this independent of indentation and of how the body is worded.
      const gateAt = source.lastIndexOf(GATE, at);
      expect(gateAt).toBeGreaterThan(-1);

      let depth = 0;
      let end = -1;
      for (let i = gateAt + GATE.length - 1; i < source.length; i += 1) {
        if (source[i] === '{') {
          depth += 1;
        } else if (source[i] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      expect(end).toBeGreaterThan(at);
    }

    // …and no side effect was moved out from behind the gate entirely.
    expect(source.match(/if \(inserted && listingId && entity\.quantity > 0\)/g)?.length).toBe(
      sideEffects.length
    );
  });
});
