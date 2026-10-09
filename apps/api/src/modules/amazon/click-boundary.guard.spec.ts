// apps/api/src/modules/amazon/click-boundary.guard.spec.ts
//
// THE CLICK BOUNDARY of an automatic Amazon purchase.
//
//   before the click            retry-safe, automatically
//   the click                   exactly once, claimed in the database
//   after the click, proven     placed
//   after the click, unproven   unknown outcome: never re-clicked automatically —
//                               only by the seller, after checking Amazon
//
// `orders.auto_fulfill_submitted_at` is stamped — as a compare-and-set —
// immediately before the Place Order click. Every rule below fails NOTHING at
// runtime when it is broken: the checkout keeps working, and one day an order
// is bought twice. That is the class of rule a source-grep guard exists for.
// The behaviour is unit-tested elsewhere (`auto-fulfill-helpers.spec.ts`,
// `amazon-checkout-interrupted.spec.ts`, `auto-fulfill-processor.service.spec.ts`);
// this file pins the ORDERING and the SQL that those tests cannot see.

import * as fs from 'fs';
import * as path from 'path';

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(__dirname, ...segments), 'utf8').replace(/\r\n/g, '\n');
}

/** Drop comments, so prose that names a forbidden construct cannot trip — or satisfy — a rule. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** The body of a method, from its signature to the next method at the same indentation. */
function methodBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) {
    throw new Error(`method not found: ${signature}`);
  }
  const rest = source.slice(start);
  const end = rest.indexOf('\n  }\n');
  return end < 0 ? rest : rest.slice(0, end);
}

const checkoutSource = read('amazon-checkout.service.ts');
const processorSource = read('auto-fulfill-processor.service.ts');

describe('the Place Order click boundary', () => {
  const checkout = stripComments(methodBody(checkoutSource, 'private async checkout('));
  const claimAt = checkout.indexOf('this.claimPlaceOrderClick(');
  const clickAt = checkout.indexOf('this.placeOrderControl(page).click(');

  it('claims the click in the database BEFORE clicking', () => {
    expect(claimAt).toBeGreaterThan(-1);
    expect(clickAt).toBeGreaterThan(-1);
    expect(claimAt).toBeLessThan(clickAt);
    // …and there is exactly one click on the Place Order control.
    expect(checkout.match(/placeOrderControl\(page\)\.click\(/g)).toHaveLength(1);
  });

  it('the claim is a compare-and-set on "no stamp yet" and "still running"', () => {
    const claim = methodBody(checkoutSource, 'private async claimPlaceOrderClick(');
    expect(claim).toContain('SET auto_fulfill_submitted_at = CURRENT_TIMESTAMP');
    expect(claim).toContain('AND auto_fulfill_submitted_at IS NULL');
    expect(claim).toContain('AND auto_fulfill_status = $3');
    expect(claim).toContain('RETURNING id');
    expect(claim).toContain('AutoFulfillStatus.RUNNING');
    // …and never for an order that already carries a real Amazon order id.
    expect(claim).toContain('AND (amazon_order_id IS NULL OR amazon_order_id LIKE $4)');
    // A lost claim never falls through to the click: all three exits throw.
    expect(stripComments(claim).match(/throw new /g)).toHaveLength(3);
  });

  it('nothing after the claim can throw, and nothing after it writes PENDING or FAILED', () => {
    const afterClaim = checkout.slice(claimAt);
    // `parseConfirmation` throws `no_confirmation` from inside its own method;
    // the checkout body itself must hold no throw past the claim.
    expect(afterClaim).not.toMatch(/\bthrow\b/);
    expect(afterClaim).not.toContain('AutoFulfillStatus.PENDING');
    expect(afterClaim).not.toContain('AutoFulfillStatus.FAILED');
    expect(afterClaim).not.toContain('this.setStatus(');
  });

  it('the confirmation parse can only stop as no_confirmation, and onPlaced never throws', () => {
    const parse = stripComments(methodBody(checkoutSource, 'private async parseConfirmation('));
    const throws = parse.match(/throw new \w+/g) ?? [];
    expect(throws).toEqual(['throw new AutoFulfillBlockedError']);
    expect(parse).toContain("'no_confirmation'");

    const onPlaced = stripComments(methodBody(checkoutSource, 'private async onPlaced('));
    expect(onPlaced).not.toMatch(/\bthrow\b/);
  });

  it('a job start reads the stamp, and an unknown outcome never reaches the rate limiter', () => {
    const run = stripComments(methodBody(checkoutSource, 'async runForOrder('));
    expect(run).toContain('decideFulfillStart(order.auto_fulfill_status, order.auto_fulfill_submitted_at)');
    const unknownAt = run.indexOf('FulfillStartDecision.UNKNOWN_OUTCOME');
    const scheduleAt = run.indexOf('this.rateLimiter.schedule(');
    expect(unknownAt).toBeGreaterThan(-1);
    expect(unknownAt).toBeLessThan(scheduleAt);
    // An order somebody already bought (a real Amazon order id) is not bought again.
    const boughtAt = run.indexOf('isSimulatedAmazonOrderId(order.amazon_order_id)');
    expect(boughtAt).toBeGreaterThan(-1);
    expect(boughtAt).toBeLessThan(scheduleAt);
    // The live eBay re-check also precedes the checkout.
    const recheckAt = run.indexOf('this.orderSync.recheckBeforePurchase(');
    expect(recheckAt).toBeGreaterThan(-1);
    expect(recheckAt).toBeLessThan(scheduleAt);
  });

  it('the processor checks the stamp first and both of its status writes carry it in SQL', () => {
    const processor = stripComments(processorSource);
    const settleAt = processor.indexOf('.settleIfClickWasSent(');
    expect(settleAt).toBeGreaterThan(-1);
    expect(settleAt).toBeLessThan(processor.indexOf('AutoFulfillStatus.FAILED'));
    expect(settleAt).toBeLessThan(processor.indexOf('AutoFulfillStatus.PENDING'));

    const writes = processor.match(/UPDATE orders SET auto_fulfill_status = \$1[\s\S]*?`/g) ?? [];
    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write).toContain('auto_fulfill_submitted_at IS NULL');
    }
  });
});

describe('the click stamp is cleared in exactly one place', () => {
  it('only the seller manual start ever sets auto_fulfill_submitted_at back to NULL', () => {
    const dirs = [__dirname, path.join(__dirname, '..', 'orders')];
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
          continue;
        }
        const source = stripComments(fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n'));
        const count = (source.match(/auto_fulfill_submitted_at = NULL/g) ?? []).length;
        if (count > 0) {
          offenders.push(`${file}:${count}`);
        }
      }
    }
    expect(offenders).toEqual(['order-sync.service.ts:1']);

    const orderSync = fs
      .readFileSync(path.join(__dirname, '..', 'orders', 'order-sync.service.ts'), 'utf8')
      .replace(/\r\n/g, '\n');
    const start = methodBody(orderSync, 'async startAutoFulfillManually(');
    // Cleared in the claim itself, and only for a row that was stamped.
    expect(start).toContain('auto_fulfill_submitted_at = NULL');
    expect(start).toContain('const clearClick = unconfirmed');
    // The claim matches whether the row was stamped when read, so a row stamped since is not taken.
    expect(start).toContain('AND (auto_fulfill_submitted_at IS NOT NULL) = $8::boolean');
    // A scan that saw a matching Amazon order refuses — before the rule, and again in the claim's SQL.
    expect(start).toContain('purchaseFoundOnAmazon');
    expect(start).toContain('suspectOnAmazon: row.suspect_unclaimed === true');
    expect(start).toContain('AND NOT (auto_fulfill_suspect_amazon_order_id IS NOT NULL');
    expect(start.indexOf('purchaseFoundOnAmazon')).toBeLessThan(start.indexOf('UPDATE orders'));
  });

  it('a status write never moves a row out of PLACED', () => {
    const setStatus = methodBody(checkoutSource, 'private async setStatus(');
    expect(setStatus).toContain('AND auto_fulfill_status <> $4');
    expect(setStatus).toContain('AutoFulfillStatus.PLACED');
  });

  it('nothing that re-arms a purchase AUTOMATICALLY takes a stamped row', () => {
    const orderSync = fs
      .readFileSync(path.join(__dirname, '..', 'orders', 'order-sync.service.ts'), 'utf8')
      .replace(/\r\n/g, '\n');
    for (const signature of [
      'private async resumeSuspendedAutoFulfill(',
      'private async releaseOrdersAwaitingPayment(',
    ]) {
      expect({ signature, guarded: methodBody(orderSync, signature).includes('auto_fulfill_submitted_at IS NULL') }).toEqual(
        { signature, guarded: true }
      );
    }
  });
});
