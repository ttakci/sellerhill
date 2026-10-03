import { readFileSync } from 'fs';
import { join } from 'path';

import { ListingStatus } from '@repo/shared';

import {
  ASIN_STORE_PRESENCE_SQL,
  decideAsinDuplicate,
  decideImportAsinConflict,
  findAsinStorePresence,
} from './cross-store-asin';

/**
 * "Allow ASINs already listed on my other stores" (operator request,
 * 2026-10-03): an ASIN on the SAME store is always a duplicate; an ASIN only
 * on OTHER stores is a duplicate unless the target store's resolved setting is
 * on. The import keeps allowing a second item on the same store.
 */

describe('decideAsinDuplicate', () => {
  it('an ASIN already on the target store is a duplicate whatever the setting says', () => {
    for (const allowCrossStore of [true, false]) {
      for (const onOtherStores of [true, false]) {
        expect(decideAsinDuplicate({ onTargetStore: true, onOtherStores, allowCrossStore })).toBe(true);
      }
    }
  });

  it('an ASIN only on other stores is a duplicate only while the setting is off', () => {
    expect(decideAsinDuplicate({ onTargetStore: false, onOtherStores: true, allowCrossStore: false })).toBe(true);
    expect(decideAsinDuplicate({ onTargetStore: false, onOtherStores: true, allowCrossStore: true })).toBe(false);
  });

  it('an ASIN the seller has nowhere is never a duplicate', () => {
    expect(decideAsinDuplicate({ onTargetStore: false, onOtherStores: false, allowCrossStore: false })).toBe(false);
  });
});

describe('decideImportAsinConflict', () => {
  it('another item of the same ASIN on the target store stays importable', () => {
    expect(decideImportAsinConflict({ onTargetStore: true, onOtherStores: false, allowCrossStore: false })).toBe(false);
  });

  it('an ASIN on another store refuses the import unless the setting is on', () => {
    expect(decideImportAsinConflict({ onTargetStore: false, onOtherStores: true, allowCrossStore: false })).toBe(true);
    expect(decideImportAsinConflict({ onTargetStore: false, onOtherStores: true, allowCrossStore: true })).toBe(false);
  });
});

describe('findAsinStorePresence', () => {
  it('casts every parameter and scopes by seller, ASIN and status', () => {
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/user_id = \$1::uuid/);
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/asin = \$2::varchar/);
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/ebay_account_id = \$3::uuid/);
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/ebay_account_id IS DISTINCT FROM \$3::uuid/);
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/status::text = ANY\(\$4::text\[\]\)/);
    expect(ASIN_STORE_PRESENCE_SQL).toMatch(/\$5::uuid IS NULL OR id <> \$5::uuid/);
  });

  it('defaults to ACTIVE + DRAFT and reads both facts from one row', async () => {
    const db = { query: jest.fn().mockResolvedValue([{ on_target_store: false, on_other_stores: true }]) };
    const presence = await findAsinStorePresence(db as never, { userId: 'u', asin: 'B0SH000001', ebayAccountId: 's' });
    expect(presence).toEqual({ onTargetStore: false, onOtherStores: true });
    expect(db.query).toHaveBeenCalledWith(ASIN_STORE_PRESENCE_SQL, [
      'u',
      'B0SH000001',
      's',
      [ListingStatus.ACTIVE, ListingStatus.DRAFT],
      null,
    ]);
  });

  it('no row reads as "nowhere"', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    await expect(
      findAsinStorePresence(db as never, { userId: 'u', asin: 'B0SH000001', ebayAccountId: 's' })
    ).resolves.toEqual({ onTargetStore: false, onOtherStores: false });
  });
});

describe('every ASIN duplicate check follows the cross-store rule', () => {
  const read = (file: string): string => readFileSync(join(__dirname, file), 'utf8');
  const listings = read('listings.service.ts');
  const processor = read('listing-processor.service.ts');
  const importer = read('listing-import.service.ts');

  it('createJob resolves the store scope once and passes it to every isAsinListed', () => {
    expect(listings).toMatch(/const storeScope = await this\.resolveAsinStoreScope\(userId, request\.ebayAccountId\)/);
    expect(listings).toMatch(/this\.isAsinListed\(userId, asin, storeScope\)/);
  });

  it('the batch worker passes the resolved scope at both checks (prefetch and prepare)', () => {
    const calls = processor.match(/isAsinListed\([^)]*\)/g) ?? [];
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call).toMatch(/asinStoreScope/);
    }
    expect(processor).toMatch(/allowCrossStore: resolvedStoreSettings\.allowCrossStoreAsins === true/);
  });

  it('no caller anywhere checks an ASIN without a store scope', () => {
    for (const source of [listings, processor, importer]) {
      expect(source).not.toMatch(/isAsinListed\(userId, (asin|item\.asin)\)/);
    }
  });

  it('draft publish decides through the shared rule on ACTIVE rows only, excluding itself', () => {
    expect(listings).toMatch(/statuses: \[ListingStatus\.ACTIVE\],\s*excludeListingId: listingId/);
    expect(listings).toMatch(/decideAsinDuplicate\(\{ \.\.\.presence, allowCrossStore: storeScope\.allowCrossStore \}\)/);
  });

  it('the existing-listing import refuses an ASIN already on another store unless allowed', () => {
    expect(importer).toMatch(/decideImportAsinConflict\(/);
    expect(importer).toMatch(/if \(await this\.isCrossStoreConflict\(data\)\)/);
    expect(importer).toMatch(/ListingFailureCode\.DUPLICATE_LISTING/);
  });
});
