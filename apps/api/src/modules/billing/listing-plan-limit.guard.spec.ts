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

// Strips `//` line comments and `/* */` block comments before matching, so a
// comment that happens to name a function or literal cannot satisfy an
// assertion meant to prove the CODE calls/uses it. This is exactly the gap
// task-12-rereview.md found: a bare `/buildRefreshEntitlementSql/`-style match
// against the whole (uncommented) file was satisfied by the explanatory
// comment above the call site even in a mutated version of the claim that
// never calls the function at all.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
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
    // Sliced to the selectRefreshBatch method body (same method-boundary
    // technique scraper-refresh.guard.spec.ts uses) and comment-stripped
    // BEFORE matching: a bare `${planLimitFilter}`/name-only match against the
    // whole raw file is also satisfied by the explanatory comment above the
    // call site, so a regression that hardcodes the fragment to '' and drops
    // the import still passed it. See the mutation-resistance test below.
    const src = read('modules', 'listings', 'refresh-processor.service.ts');
    const start = src.indexOf('private async selectRefreshBatch(');
    const end = src.indexOf('private async resolveBatchSize(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = stripComments(src.slice(start, end));

    expect(body).toMatch(/buildRefreshEntitlementSql\(enforcementOn\)/);
    expect(body).toMatch(/\$\{planLimitFilter\}/);
    expect(body).toMatch(/\$\{entitlementJoin\}/);

    // The predicate itself now lives in the shared builder both the refresh
    // claim and the admin operations summary's refresh-lag query read from
    // (Task 12 review fix round 1), so the two can never drift apart.
    const entitlementSrc = read('modules', 'listings', 'refresh-entitlement-sql.ts');
    expect(entitlementSrc).toMatch(/AND l\.over_plan_limit = FALSE/);
  });

  it('is not vacuous: fails against the exact mutation that slipped past fix round 1', () => {
    // Reproduces task-12-rereview.md's mutation M1 against the REAL method
    // body, comments included: replace the builder call with hardcoded
    // empty-string assignments (compiles, lint-clean). The explanatory
    // comment naming `buildRefreshEntitlementSql` sits just above the call
    // site and survives this mutation untouched — which is exactly what let
    // the OLD, unscoped assertion pass. Prove the CURRENT assertion (call
    // shape, sliced to the method body, comments stripped) correctly fails.
    const src = read('modules', 'listings', 'refresh-processor.service.ts');
    const start = src.indexOf('private async selectRefreshBatch(');
    const end = src.indexOf('private async resolveBatchSize(');
    const rawBody = src.slice(start, end);

    const mutatedRawBody = rawBody.replace(
      'const { entitlementJoin, planLimitFilter, storeActiveFilter } = buildRefreshEntitlementSql(enforcementOn);',
      `const entitlementJoin = ''; const planLimitFilter = ''; const storeActiveFilter = '';`
    );
    // Sanity: the mutation actually landed, and it did NOT touch the
    // explanatory comment — i.e. this is a faithful reproduction of M1, not
    // a strawman that also happens to erase the trap.
    expect(mutatedRawBody).not.toBe(rawBody);
    expect(mutatedRawBody).toMatch(/buildRefreshEntitlementSql/);

    const mutatedBody = stripComments(mutatedRawBody);
    expect(mutatedBody).not.toMatch(/buildRefreshEntitlementSql\(enforcementOn\)/);
  });

  it('pushes no price/stock update to a listing over the limit', () => {
    const src = read('modules', 'listings', 'product-sync.service.ts');
    expect(src).toMatch(/AND over_plan_limit = FALSE/);
  });

  it('decides the order flag once, at first ingest, never on re-sync', () => {
    const src = read('modules', 'orders', 'order-sync.service.ts');
    expect(src).toMatch(/SELECT id, product_id, over_plan_limit FROM listings/);
    const columns = src.slice(src.indexOf('INSERT INTO orders ('));
    expect(columns.slice(0, columns.indexOf(') VALUES'))).toMatch(/listing_over_plan_limit/);
    const onConflict = src.slice(src.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'));
    const setClause = onConflict.slice(0, onConflict.indexOf('RETURNING'));
    expect(setClause).not.toMatch(/listing_over_plan_limit/);
  });

  it('skips auto-fulfill (not blocks) for an order from a listing over the limit', () => {
    // SKIPPED, never BLOCKED: the plan working as designed must not raise an
    // action-required alarm the seller cannot clear.
    const src = read('modules', 'orders', 'order-sync.service.ts');
    expect(src).toMatch(
      /AutoFulfillStatus\.SKIPPED,\s*AutoFulfillBlockedReason\.LISTING_OVER_PLAN_LIMIT/,
    );
    expect(src).not.toMatch(
      /AutoFulfillStatus\.BLOCKED,\s*AutoFulfillBlockedReason\.LISTING_OVER_PLAN_LIMIT/,
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
