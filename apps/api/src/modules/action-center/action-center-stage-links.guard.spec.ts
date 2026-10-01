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
});
