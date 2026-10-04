import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Listing rules belong to the Listing Settings Group (migration 141, spec
// Part A); the blocked-ASIN list belongs to the store. These greps keep every
// reader on the right source, because a reader left on the old store-settings
// column would compile against a NULL and silently refuse nothing.

const read = (rel: string): string => readFileSync(join(__dirname, rel), 'utf8');

describe('listing rules are read from the group', () => {
  it('the create worker reads rules from the job group and blocked ASINs from the store', () => {
    const src = read('listing-processor.service.ts');
    expect(src).not.toMatch(/resolvedStoreSettings\.listingRules/);
    expect(src).toMatch(/normalizeListingRules\(\s*\w+\.listingRules\s*\)/);
    expect(src).toMatch(/isAsinBlocked\(\s*resolvedStoreSettings\.blockedAsins/);
  });

  it('hideBrand comes from the group', () => {
    expect(read('listing-strategy.service.ts')).toMatch(/group\.listingRules\.hideBrand/);
  });

  it('clean-up, not-selling and the Action Center read the group, never store_settings.listing_rules', () => {
    for (const file of [
      'listing-cleanup.helpers.ts',
      'listing-cleanup.service.ts',
      '../action-center/action-center.service.ts',
    ]) {
      expect(read(file)).not.toMatch(/store_settings[\s\S]{0,80}listing_rules/);
      expect(read(file)).toMatch(/listing_settings_groups|buildGroupRuleSql/);
    }
  });

  it('auto-promote after create/publish is gone', () => {
    expect(read('listings.service.ts')).not.toMatch(/promoteNewListings/);
    expect(read('listing-processor.service.ts')).not.toMatch(/promoteNewListings/);
    expect(existsSync(join(__dirname, 'listing-promotion.service.ts'))).toBe(false);
  });
});
