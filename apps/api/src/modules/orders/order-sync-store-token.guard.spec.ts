import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Order sync runs once PER eBay STORE and tags every row it writes with that
 * store's id. It must therefore read eBay with THAT store's token.
 *
 * It used `getActiveAccountAccessToken(userId)` — an unordered `LIMIT 1` over
 * the user's active stores. With two stores (production, 2026-10-03) the sync
 * of store A fetched store B's orders and wrote them tagged as A: eleven
 * orders of a newly connected store landed under the other store, and that
 * store's own orders were never fetched by its own run.
 */
const SOURCE = readFileSync(join(__dirname, 'order-sync.service.ts'), 'utf8');

function methodBody(name: string): string {
  const start = SOURCE.indexOf(`async ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = SOURCE.indexOf('\n  async ', start + 10);
  const nextPrivate = SOURCE.indexOf('\n  private async ', start + 10);
  const ends = [next, nextPrivate].filter((i) => i > -1);
  return SOURCE.slice(start, ends.length ? Math.min(...ends) : undefined);
}

describe('order sync reads each store with its own token', () => {
  it('never asks for "an" active account of the user', () => {
    expect(SOURCE).not.toMatch(/getActiveAccountAccessToken\(/);
    expect(SOURCE).not.toMatch(/getActiveAccountId\(/);
  });

  it('syncOrdersForAccount fetches with the token of the store it is syncing', () => {
    expect(methodBody('syncOrdersForAccount')).toMatch(/getAccountAccessToken\(ebayAccountId\)/);
  });

  it('the payment re-check and the suspension resume are scoped to that store', () => {
    expect(methodBody('releaseOrdersAwaitingPayment')).toMatch(/AND ebay_account_id = \$\d+/);
    expect(methodBody('resumeSuspendedAutoFulfill')).toMatch(/AND ebay_account_id = \$\d+/);
  });
});
