import { readFileSync } from 'fs';
import { join } from 'path';

import { buildListingStoreActiveSql } from './listing-store-active-sql';

/**
 * A disconnected store's listings stay ACTIVE but are outside every
 * automation scope (operator decision, 2026-10-03). Each scope below must
 * apply the ONE predicate — a forgotten one fails silently (the listing keeps
 * a plan slot, or a refresh/push runs for a store with no token).
 */
const api = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(api, rel), 'utf8');

describe('buildListingStoreActiveSql', () => {
  it('keeps no-store rows and requires an active store otherwise', () => {
    const sql = buildListingStoreActiveSql('l');
    expect(sql).toMatch(/l\.ebay_account_id IS NULL OR EXISTS/);
    expect(sql).toMatch(/store_ea\.status = 'active'/);
  });

  it('refuses an alias that is not a plain identifier', () => {
    expect(() => buildListingStoreActiveSql('l; DROP TABLE x')).toThrow();
  });
});

describe('every listing-automation scope applies the store-active predicate', () => {
  it.each([
    ['plan count + plan ranking', 'modules/billing/billing-repository.service.ts', 3],
    ['refresh claim + admin refresh lag (shared builder)', 'modules/listings/refresh-entitlement-sql.ts', 1],
    ['price/stock fan-out + unchanged-check revisions', 'modules/listings/product-sync.service.ts', 2],
  ])('%s', (_label, file, minUses) => {
    const uses = read(file).match(/buildListingStoreActiveSql\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(minUses);
  });

  it('the refresh claim and the admin lag query interpolate the store filter', () => {
    expect(read('modules/listings/refresh-processor.service.ts')).toMatch(/\$\{storeActiveFilter\}/);
    expect(read('modules/admin/admin.service.ts')).toMatch(/\$\{storeActiveFilter\}/);
  });
});
