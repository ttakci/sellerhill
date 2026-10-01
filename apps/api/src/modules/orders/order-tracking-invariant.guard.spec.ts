import fs from 'fs';
import path from 'path';

// Normalized to LF — the repo is checked out with CRLF on Windows and these
// assertions pin multi-line shapes.
const source = fs
  .readFileSync(path.join(__dirname, 'order-sync.service.ts'), 'utf8')
  .replace(/\r\n/g, '\n');

describe('order ingest tracking invariant', () => {
  // A buyer who paid for an item whose listing ended a minute later is still
  // owed the item. Matching on ACTIVE left that order untracked for ever (no
  // cost, no automatic purchase, off the dashboard), so the match is on the
  // eBay item id alone — UNIQUE, and a draft has none (operator decision,
  // 2026-10-01). What stays pinned is everything below: the listing is still
  // assigned at FIRST ingest only, never on a re-sync.
  it('matches a sale to its SellerHill listing by eBay item id, whatever the listing status', () => {
    expect(source).toContain('WHERE ebay_item_id = $1 AND user_id = $2\n               LIMIT 1');
    expect(source).toContain('[lineItem.legacyItemId, userId]');
    expect(source).not.toContain('ListingStatus.ACTIVE]');
  });

  it('stores the product cost of an ORDER as unit price x quantity', () => {
    expect(source).toContain('purchasePrice = toOrderCost(productData.purchasePrice, lineItem?.quantity);');
    expect(source).toContain('resolvedPurchase = toOrderCost(productData.purchasePrice, o.quantity);');
  });

  it('never buys one line of a multi-item order', () => {
    const body = source.slice(
      source.indexOf('private async maybeEnqueueAutoFulfill('),
      source.indexOf('private async resolveAndEnqueueAutoFulfill(')
    );
    const guardAt = body.indexOf('if (entity.lineItemCount > 1) {');
    expect(guardAt).toBeGreaterThan(-1);
    expect(body).toContain('AutoFulfillBlockedReason.MULTI_ITEM_ORDER');
    // …ahead of the chain that enqueues a real purchase.
    expect(guardAt).toBeLessThan(body.indexOf('await this.resolveAndEnqueueAutoFulfill('));
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
    //
    // Since order sync re-reads by modification date (2026-09-30) the two
    // effects that ACT on the sale are gated one step tighter, on a FRESH sale
    // (`decideIngest`): inserted, created after the store was connected, and
    // recent. The sold counter only records, so it stays on the insert.
    const INSERT_GATE = 'if (inserted && listingId && entity.quantity > 0) {';
    const FRESH_GATE = 'if (freshSale && listingId && entity.quantity > 0) {';
    expect(source).toContain('const freshSale = ingest.isFreshSale(inserted);');
    // Matched as call sites, not bare names: each of these is also mentioned in
    // a nearby comment, and a comment must not be able to satisfy this guard.
    const sideEffects: Array<[string, string]> = [
      ['this.productsService.decrementStock(', FRESH_GATE], // sale-driven stock sync
      ['SET sold_count = sold_count +', INSERT_GATE], // real-time sold count
      ['this.maybeEnqueueAutoFulfill(', FRESH_GATE], // A2 auto purchase
    ];

    for (const [effect, GATE] of sideEffects) {
      const at = source.indexOf(effect);
      expect(at).toBeGreaterThan(-1);

      // Walk the nearest preceding gate to its matching `}` by counting braces,
      // then assert the effect falls inside that span. Brace counting is what
      // makes this independent of indentation and of how the body is worded.
      const gateAt = source.lastIndexOf(GATE, at);
      expect(gateAt).toBeGreaterThan(-1);
      // …and it is the NEAREST gate of either kind, so an effect cannot sit
      // behind the looser one while the tighter one exists further up.
      expect(gateAt).toBeGreaterThanOrEqual(
        Math.max(source.lastIndexOf(INSERT_GATE, at), source.lastIndexOf(FRESH_GATE, at))
      );

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
    expect(source.match(/if \((inserted|freshSale) && listingId && entity\.quantity > 0\)/g)?.length).toBe(
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
    // …nor a cancelled one, nor an order first seen long after it was placed.
    expect(source).toContain(
      'if (freshSale && !isOrderAlreadyFulfilled(entity.status) && entity.status !== OrderStatus.CANCELLED) {'
    );
  });

  it('can undo an unpaid skip, and bounds what that costs', () => {
    // The skip is only safe because it is reversible. Order sync does re-read
    // a modified order, but it starts automation only on a first insert, so
    // without this sweep the refusal is permanent.
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
