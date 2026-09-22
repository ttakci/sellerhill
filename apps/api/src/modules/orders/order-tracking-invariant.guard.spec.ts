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

/**
 * Removing any of these fails NOTHING at runtime — auto-fulfill simply starts
 * buying orders it should not, which is money out the door and only visible
 * afterwards. That is precisely the class of rule this file exists to pin.
 */
describe('auto-fulfill order-state gate', () => {
  it('decides eligibility from the order state before anything else', () => {
    const body = source.slice(
      source.indexOf('private async maybeEnqueueAutoFulfill('),
      source.indexOf('private async resolveAndEnqueueAutoFulfill(')
    );
    expect(body).toContain('resolveAutoFulfillEligibility(entity.status)');

    // Ahead of the plan-limit branch: an already-shipped order needed no
    // purchase at any plan size, so "over plan limit" would be the wrong reason.
    expect(body.indexOf('resolveAutoFulfillEligibility')).toBeLessThan(
      body.indexOf('if (listingOverPlanLimit)')
    );

    // …and an ineligible order returns rather than falling through to the
    // resolution chain that enqueues a real purchase.
    const check = body.slice(body.indexOf('if (!eligibility.eligible) {'));
    expect(check.slice(0, check.indexOf('}'))).toContain('return;');
  });

  it('does not greet an already-shipped order with a thank-you message', () => {
    // Same returning-seller backlog, different damage: a real buyer receives a
    // "we're preparing your order" weeks after their parcel arrived.
    expect(source).toContain('if (inserted && !isOrderAlreadyFulfilled(entity.status)) {');
  });

  it('can undo an unpaid skip, and bounds what that costs', () => {
    // The skip is only safe because it is reversible: order sync filters on
    // creationdate with non-overlapping windows, so nothing else ever observes
    // a later payment. Without this sweep the refusal is permanent.
    expect(source).toContain('private async releaseOrdersAwaitingPayment(');
    expect(source).toContain('this.releaseOrdersAwaitingPayment(');

    const sweep = source.slice(source.indexOf('private async releaseOrdersAwaitingPayment('));
    // Duplicate-purchase guard, same rule the suspension sweep applies.
    expect(sweep).toContain('AND amazon_order_id IS NULL');
    // Bounded: a metered eBay call per candidate. The per-ORDER interval is the
    // load-bearing one — a per-tick limit alone scales with ticks × sellers and
    // would exhaust the shared Fulfillment quota on its own.
    expect(sweep).toMatch(/order_date > NOW\(\) - INTERVAL '7 days'/);
    expect(sweep).toContain('AWAITING_PAYMENT_RECHECK_LIMIT');
    expect(sweep).toContain('AWAITING_PAYMENT_RECHECK_INTERVAL_HOURS');
    expect(sweep).toMatch(/auto_fulfill_attempted_at < NOW\(\)/);
    // …and the attempt is stamped before the call, so a failing row cannot be
    // retried every tick.
    const stampAt = sweep.indexOf('SET auto_fulfill_attempted_at = NOW()');
    expect(stampAt).toBeGreaterThan(-1);
    expect(stampAt).toBeLessThan(sweep.indexOf('fetchOrderById('));
    // Re-decided through the same rule, never re-enqueued unconditionally.
    expect(sweep).toContain('resolveAutoFulfillEligibility(status)');
  });
});
