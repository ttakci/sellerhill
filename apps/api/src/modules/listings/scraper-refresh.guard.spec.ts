// apps/api/src/modules/listings/scraper-refresh.guard.spec.ts
//
// Source-greps that keep two scraper-provider invariants in
// refresh-processor.service.ts true, since a regression in either fails
// silently (no test failure, just a worse-than-designed runtime behaviour):
//
// (a) the no-proxy pause check must run BEFORE the FOR UPDATE SKIP LOCKED
//     claim in selectRefreshBatch — moved after it, a paused tick would still
//     lease rows it can never refresh, holding them past their normal
//     next_refresh_at for no reason (see the brief's "no proxy → no request,
//     nothing leased" requirement).
// (b) the Keepa UPDATE writes stock_status on BOTH the changed and unchanged
//     branches of applyKeepaProduct — losing either write reintroduces the
//     rollback bug fixed in fix round 1 (a stale scraper-era stock_status
//     that Keepa never corrects because the row happened to take the "no
//     change" branch).
//
// Same approach as listing-plan-limit.guard.spec.ts: neither of these is
// reachable from a mocked unit test without a real Postgres round trip, so
// the SQL text itself is the thing under test.

import * as fs from 'fs';
import * as path from 'path';

const API_SRC = path.join(__dirname, '..', '..');

// Line endings normalized: the file is CRLF and the slices below look for
// multi-line shapes.
function read(...segments: string[]): string {
  return fs.readFileSync(path.join(API_SRC, ...segments), 'utf8').replace(/\r\n/g, '\n');
}

describe('scraper refresh invariants (refresh-processor.service.ts)', () => {
  const src = read('modules', 'listings', 'refresh-processor.service.ts');

  it('the no-proxy pause check runs before the claim query in selectRefreshBatch', () => {
    const start = src.indexOf('private async selectRefreshBatch(');
    const end = src.indexOf('private async resolveBatchSize(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    const pauseIndex = body.indexOf('no proxies configured');
    const claimIndex = body.indexOf('FOR UPDATE SKIP LOCKED');
    expect(pauseIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(-1);
    expect(pauseIndex).toBeLessThan(claimIndex);
  });

  it('the Keepa UPDATE writes stock_status on both the changed and unchanged branches', () => {
    const start = src.indexOf('private async applyKeepaProduct(');
    const end = src.indexOf('private async handleDataFailure(');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);

    const writes = body.match(/stock_status = COALESCE\(/g) ?? [];
    expect(writes.length).toBe(2);
  });

  it('the Keepa UPDATE clears scraper-only columns on rollback, in both branches', () => {
    const start = src.indexOf('private async applyKeepaProduct(');
    const end = src.indexOf('private async handleDataFailure(');
    const body = src.slice(start, end);

    const capClears = body.match(/max_order_quantity = CASE WHEN \$\d+::boolean THEN NULL ELSE max_order_quantity END/g) ?? [];
    const removedClears = body.match(/source_removed_at = CASE WHEN \$\d+::boolean THEN NULL ELSE source_removed_at END/g) ?? [];
    expect(capClears.length).toBe(2);
    expect(removedClears.length).toBe(2);
  });
});
