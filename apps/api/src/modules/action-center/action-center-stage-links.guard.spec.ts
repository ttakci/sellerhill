// apps/api/src/modules/action-center/action-center-stage-links.guard.spec.ts
//
// Every Action Center order row deep-links to the list page; since the list
// filters by `?stage=` (2026-09-29), a link still carrying
// `?fulfillmentState=` lands on an unfiltered list — the seller is told
// "3 need you" and handed all 400 again. And the counts must come from the
// same CASE the list filters on, or the badge and the list disagree.

import * as fs from 'fs';
import * as path from 'path';

describe('Action Center order links', () => {
  const src = fs.readFileSync(path.join(__dirname, 'action-center.service.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('links every order item with ?stage=, never ?fulfillmentState=', () => {
    expect(src).not.toMatch(/\/orders\?fulfillmentState=/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.AMAZON_CANCELLED\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.PURCHASE_BLOCKED\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.PURCHASE_UNKNOWN\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.TO_PURCHASE\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.TRACKING_HELD\}/);
  });

  it('counts blocked, cancelled and awaiting-purchase orders through buildOrderStageSql', () => {
    expect(src).toMatch(/buildOrderStageSql\('o'\)/);
    expect(src).not.toMatch(/buildFulfillmentStateSql/);
  });

  /*
   * `?ebayAccountId=` (2026-10-04): a store-filtered page must count only that
   * store, or "3 need you in store B" lands on store B's list of one. Every
   * statement over a per-store table carries the store predicate, and the
   * predicate types its parameter on every use.
   */
  const count = (re: RegExp) => (src.match(re) ?? []).length;

  it('scopes every per-store count to the store filter', () => {
    expect(count(/FROM orders o\b/g)).toBeGreaterThan(0);
    expect(count(/storeScopeSql\('o', \d\)/g)).toBe(count(/FROM orders o\b/g));
    expect(count(/storeScopeSql\('l', \d\)/g)).toBe(count(/FROM listings l\b/g));
    expect(count(/storeScopeSql\('r', \d\)/g)).toBe(count(/FROM ebay_returns r\b/g));
    expect(count(/storeScopeSql\('c', \d\)/g)).toBe(count(/FROM ebay_cancellations c\b/g));
    expect(count(/storeScopeSql\('j', \d\)/g)).toBe(count(/JOIN listing_jobs j\b/g));
    expect(count(/FROM ebay_accounts a\b/g)).toBe(count(/\(\$4::uuid IS NULL OR a\.id = \$4::uuid\)/g));
  });

  it('casts the store parameter on both of its uses', () => {
    expect(src).toMatch(/\(\$\$\{param\}::uuid IS NULL OR \$\{alias\}\.ebay_account_id = \$\$\{param\}::uuid\)/);
  });

  it('carries the store on the links and leaves account-wide items unfiltered', () => {
    expect(src).toMatch(/scopeItemsToStore\(probes\.flat\(\), store\)/);
    expect(src).toMatch(/this\.planItems\(userId\)/);
    expect(src).toMatch(/this\.setupItems\(userId\)/);
  });
});
