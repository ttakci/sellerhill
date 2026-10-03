import { EbayAccountStatus } from '@repo/shared';

/**
 * "The listing's eBay store is connected" — the one SQL predicate every
 * listing-automation scope applies (operator decision, 2026-10-03).
 *
 * Disconnecting a store flips only its `ebay_accounts` row; its listings stay
 * ACTIVE (they are still live on eBay and come back on reconnect). Without
 * this predicate they kept counting against the plan, ranked FIRST in the
 * plan-limit order (being older) and pushed the connected store's newer
 * listings over the limit, kept their products claimed for refresh, and fed a
 * fan-out that failed on the missing token. With it they are simply outside
 * the plan count, the plan ranking, the refresh claim and the price/stock
 * push until the store is reconnected — no state is written, so reconnecting
 * brings everything back by itself.
 *
 * A listing with no store (pre-migration-030 rows; none in production) is
 * kept in scope, as before.
 */
export function buildListingStoreActiveSql(alias: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(alias)) {
    throw new Error(`Unsafe SQL alias: ${alias}`);
  }
  return `(${alias}.ebay_account_id IS NULL OR EXISTS (
            SELECT 1 FROM ebay_accounts store_ea
             WHERE store_ea.id = ${alias}.ebay_account_id
               AND store_ea.status = '${EbayAccountStatus.ACTIVE}'))`;
}
