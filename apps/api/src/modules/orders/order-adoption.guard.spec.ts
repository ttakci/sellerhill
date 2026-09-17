// apps/api/src/modules/orders/order-adoption.guard.spec.ts
//
// Importing an existing eBay listing LINKS its past orders to it (migration
// 111) — and must never do anything more than link them.
//
// The reason orders were never back-matched before is that doing so naively
// would have sent months-old orders shopping on Amazon: auto-fulfill used to be
// the only consequence anyone imagined for "this order now has a listing". It
// is safe precisely because the two are separate — matching happens at ingest,
// purchasing fires only on a genuine INSERT — and that separation is one edit
// away from being lost, so it is asserted here.

import * as fs from 'fs';
import * as path from 'path';

function read(...segments: string[]): string {
  return fs
    .readFileSync(path.join(__dirname, '..', '..', ...segments), 'utf8')
    .replace(/\r\n/g, '\n');
}

describe('adopting past orders into an imported listing', () => {
  const orderSync = read('modules', 'orders', 'order-sync.service.ts');
  const adopt = orderSync.slice(orderSync.indexOf('async adoptUntrackedOrdersForListing('));
  const body = adopt.slice(0, adopt.indexOf('\n  }\n'));

  it('only ever claims orders that have NO listing', () => {
    // Without this an order could be moved from the listing it was matched to
    // at ingest onto a different one imported later.
    expect(body).toMatch(/AND listing_id IS NULL/);
  });

  it('is scoped to one seller and one store', () => {
    expect(body).toMatch(/WHERE user_id = \$3/);
    expect(body).toMatch(/AND ebay_account_id = \$4/);
    expect(body).toMatch(/AND ebay_legacy_item_id = \$5/);
  });

  it('recomputes profit through the single writer rather than writing it itself', () => {
    expect(body).toMatch(/this\.recomputeProfit\(/);
    expect(body).not.toMatch(/cost_capture_status\s*=/);
  });

  it('never enqueues an automatic purchase', () => {
    expect(body).not.toMatch(/autoFulfill|maybeEnqueue|resolveAndEnqueue/i);
  });

  it('is the only thing the import path does with orders', () => {
    const importService = read('modules', 'listings', 'listing-import.service.ts');
    expect(importService).toMatch(/adoptUntrackedOrdersForListing\(/);
    expect(importService).not.toMatch(/autoFulfill|AutoFulfillQueueService/i);
  });

  it('keeps the ingest-time match rule: listing_id is never set by a re-sync', () => {
    const onConflict = orderSync.slice(orderSync.indexOf('ON CONFLICT (ebay_order_id) DO UPDATE SET'));
    const setClause = onConflict.slice(0, onConflict.indexOf('RETURNING'));
    expect(setClause).not.toMatch(/listing_id =/);
  });
});
