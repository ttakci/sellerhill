import { ListingStatus } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';

/**
 * "Allow ASINs already listed on my other stores" (store setting
 * `allowCrossStoreAsins`, migration 140, operator request 2026-10-03).
 *
 * The listings table holds one row per (seller, store, ASIN) live or draft
 * offer. For a target store S and an ASIN X:
 *   - X ACTIVE/DRAFT on S itself → always a duplicate (create, draft, prefetch).
 *   - X ACTIVE/DRAFT only on OTHER stores of the seller → a duplicate unless the
 *     RESOLVED setting for S (store ?? global ?? false) is on.
 *
 * Set globally it lets every store take any ASIN; set on one store only, that
 * store may take ASINs the others already carry. The plan limit is untouched —
 * every listing still counts against it.
 */

/** Where the seller already has the ASIN, relative to the target store. */
export interface AsinStorePresence {
  onTargetStore: boolean;
  onOtherStores: boolean;
}

/** The target store and its resolved setting, resolved once per job/batch. */
export interface AsinStoreScope {
  ebayAccountId: string;
  allowCrossStore: boolean;
}

/** Create / draft / publish: is listing this ASIN on the target store a duplicate? */
export function decideAsinDuplicate(input: AsinStorePresence & { allowCrossStore: boolean }): boolean {
  if (input.onTargetStore) {
    return true;
  }
  return input.onOtherStores && !input.allowCrossStore;
}

/**
 * Existing-listing import: the eBay item already exists on the target store,
 * so a second item of the same ASIN on THAT store is the seller's own store
 * layout and stays allowed (as before). Only the cross-store rule applies:
 * the ASIN being on another store refuses the import unless the setting is on.
 */
export function decideImportAsinConflict(input: AsinStorePresence & { allowCrossStore: boolean }): boolean {
  return input.onOtherStores && !input.allowCrossStore;
}

/** The statuses that make an ASIN "listed": live offers and drafts. */
export const LISTED_ASIN_STATUSES: readonly ListingStatus[] = [ListingStatus.ACTIVE, ListingStatus.DRAFT];

/**
 * One query, both facts. A listing whose store is NULL (its store row was
 * deleted) is not on the target store, so it counts as "another store".
 * Parameters: $1 user id, $2 ASIN, $3 target store id, $4 statuses,
 * $5 listing id to ignore (or NULL).
 */
export const ASIN_STORE_PRESENCE_SQL = `
  SELECT
    COALESCE(BOOL_OR(ebay_account_id = $3::uuid), FALSE) AS on_target_store,
    COALESCE(BOOL_OR(ebay_account_id IS DISTINCT FROM $3::uuid), FALSE) AS on_other_stores
  FROM listings
  WHERE user_id = $1::uuid
    AND asin = $2::varchar
    AND status::text = ANY($4::text[])
    AND ($5::uuid IS NULL OR id <> $5::uuid)
`;

export type AsinPresenceQuery = Pick<DatabaseService, 'query'>;

/** Read where the seller already has `asin`, relative to `ebayAccountId`. */
export async function findAsinStorePresence(
  db: AsinPresenceQuery,
  input: {
    userId: string;
    asin: string;
    ebayAccountId: string;
    statuses?: readonly ListingStatus[];
    excludeListingId?: string | null;
  },
): Promise<AsinStorePresence> {
  const rows = await db.query<{ on_target_store: boolean; on_other_stores: boolean }>(ASIN_STORE_PRESENCE_SQL, [
    input.userId,
    input.asin,
    input.ebayAccountId,
    [...(input.statuses ?? LISTED_ASIN_STATUSES)],
    input.excludeListingId ?? null,
  ]);
  const row = rows[0];
  return {
    onTargetStore: row?.on_target_store === true,
    onOtherStores: row?.on_other_stores === true,
  };
}
