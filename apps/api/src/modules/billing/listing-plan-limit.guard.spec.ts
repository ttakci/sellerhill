// apps/api/src/modules/billing/listing-plan-limit.guard.spec.ts
//
// Source-greps that keep "only listings within the plan limit are automated"
// true everywhere it has to hold. The rule is enforced by one flag read at many
// independent sites (refresh claim, price/stock fan-out, order ingest,
// auto-fulfill, shipment tracking, on-demand conversion). A site that forgets
// the predicate fails silently — the listing just keeps being automated — so a
// unit test cannot catch it; asserting the reads exist can. Same approach as
// entitlement-enforcement.guard.spec.ts.

import * as fs from 'fs';
import * as path from 'path';

const API_SRC = path.join(__dirname, '..', '..');

// Line endings normalized: several of these files are CRLF, and the slices
// below look for multi-line shapes.
function read(...segments: string[]): string {
  return fs.readFileSync(path.join(API_SRC, ...segments), 'utf8').replace(/\r\n/g, '\n');
}

describe('listing plan-limit invariants', () => {
  it('ranks oldest-first with a deterministic tie-break', () => {
    const src = read('modules', 'billing', 'billing-repository.service.ts');
    expect(src).toMatch(/ROW_NUMBER\(\) OVER \(ORDER BY created_at ASC NULLS FIRST, id ASC\)/);
  });

  it('ignores suspension when resolving the tracking limit', () => {
    // A suspended account resolved as limit 0 would flag every listing, and the
    // flags would outlive the suspension after payment.
    const src = read('modules', 'billing', 'quota-enforcement.service.ts');
    const method = src.slice(src.indexOf('async resolveListingPlanLimit('));
    const body = method.slice(0, method.indexOf('\n  }\n'));
    expect(body).not.toMatch(/resolveEffectiveEntitlement|resolveSubscriptionContext/);
  });

  it('keeps Keepa refresh off products whose only active listings are over the limit', () => {
    const src = read('modules', 'listings', 'refresh-processor.service.ts');
    expect(src).toMatch(/AND l\.over_plan_limit = FALSE/);
    expect(src).toMatch(/\$\{planLimitFilter\}/);
  });

  it('pushes no price/stock update to a listing over the limit', () => {
    const src = read('modules', 'listings', 'product-sync.service.ts');
    expect(src).toMatch(/AND over_plan_limit = FALSE/);
  });

  it('decides the order flag once, at first ingest, never on re-sync', () => {
    const src = read('modules', 'orders', 'order-sync.service.ts');
    expect(src).toMatch(/SELECT id, product_id, over_plan_limit FROM listings/);
    expect(src).toMatch(/listing_over_plan_limit\n\s*\) VALUES/);
    const onConflict = src.slice(src.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'));
    const setClause = onConflict.slice(0, onConflict.indexOf('RETURNING'));
    expect(setClause).not.toMatch(/listing_over_plan_limit/);
  });

  it('skips auto-fulfill (not blocks) for an order from a listing over the limit', () => {
    const src = read('modules', 'orders', 'order-sync.service.ts');
    expect(src).toMatch(
      /\[AutoFulfillStatus\.SKIPPED, AutoFulfillBlockedReason\.LISTING_OVER_PLAN_LIMIT, entity\.ebayOrderId\]/,
    );
  });

  it('never tracks the shipment of an order from a listing over the limit', () => {
    const processor = read('modules', 'amazon', 'amazon-tracking-processor.service.ts');
    expect(processor).toMatch(/if \(order\.listing_over_plan_limit\)/);
    const queue = read('modules', 'amazon', 'amazon-tracking-queue.service.ts');
    expect(queue).toMatch(/AND listing_over_plan_limit = FALSE/);
  });

  it('refuses on-demand conversion for an order from a listing over the limit', () => {
    const src = read('modules', 'amazon', 'tracking-conversion.service.ts');
    expect(src).toMatch(/orders\.errors\.listingOverPlanLimit/);
  });

  it('re-checks suspension when an auto-fulfill job executes, not only at enqueue', () => {
    const src = read('modules', 'amazon', 'amazon-checkout.service.ts');
    const runner = src.slice(src.indexOf('async runForOrder('));
    const beforeRunning = runner.slice(0, runner.indexOf('AutoFulfillStatus.RUNNING'));
    expect(beforeRunning).toMatch(/quotaEnforcement\.isSuspended\(/);
    expect(beforeRunning).toMatch(/SUBSCRIPTION_SUSPENDED/);
  });
});
