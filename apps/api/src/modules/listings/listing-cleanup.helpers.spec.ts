import { readFileSync } from 'fs';
import { join } from 'path';

import { ListingAutoEndReason } from '@repo/shared';

import {
  buildCleanupCandidateSql,
  buildGroupRuleSql,
  buildNotSellingSql,
} from './listing-cleanup.helpers';

describe('clean-up candidate SQL', () => {
  const outOfStock = buildCleanupCandidateSql(ListingAutoEndReason.OUT_OF_STOCK);
  const notSelling = buildCleanupCandidateSql(ListingAutoEndReason.NOT_SELLING);

  it.each([outOfStock, notSelling])('only ever names an ACTIVE listing with an offer id, scoped to one store', (sql) => {
    expect(sql).toContain(`l.status = 'active'`);
    expect(sql).toContain('l.ebay_offer_id IS NOT NULL');
    expect(sql).toContain('l.user_id = $1');
    expect(sql).toContain('l.ebay_account_id = $2');
    expect(sql).toContain('auto_end_failed_at');
    expect(sql).toMatch(/LIMIT \$3::int/);
    expect(sql).not.toContain('$4');
  });

  it('reads the day count per listing from its settings group', () => {
    expect(outOfStock).toContain('listing_settings_groups');
    expect(outOfStock).toContain(`'outOfStockEndDays'`);
    expect(notSelling).toContain(`'coldListingDays'`);
  });

  it("ends a not-selling listing only with the group's second switch on", () => {
    expect(notSelling).toContain(`'coldListingAutoEnd'`);
  });

  it('never ends a listing the seller paused on purpose', () => {
    expect(outOfStock).toContain('l.disable_ordering = FALSE');
    expect(outOfStock).toContain('l.lock_quantity = TRUE');
  });

  it('counts a not-selling window from creation, and looks for any order inside it', () => {
    expect(notSelling).toMatch(/l\.created_at <= NOW\(\) - make_interval\(days =>/);
    expect(notSelling).toMatch(/o\.order_date > NOW\(\) - make_interval\(days =>/);
  });
});

describe('buildGroupRuleSql', () => {
  it("reads one rule of the listing's own group, typed", () => {
    expect(buildGroupRuleSql('l', 'outOfStockEndDays')).toBe(
      `(SELECT (gr.listing_rules->>'outOfStockEndDays')::int FROM listing_settings_groups gr WHERE gr.id = l.listing_settings_group_id)`
    );
    expect(buildGroupRuleSql('x', 'coldListingAutoEnd')).toContain(`::boolean FROM listing_settings_groups gr WHERE gr.id = x.listing_settings_group_id`);
  });
});

describe('the not-selling predicate has one definition', () => {
  const read = (file: string): string => readFileSync(join(__dirname, file), 'utf8');

  it('is what both the listings filter and the Action Center count use', () => {
    expect(read('listings.service.ts')).toContain(`buildNotSellingSql('l')`);
    expect(read('../action-center/action-center.service.ts')).toContain(`buildNotSellingSql('l')`);
  });

  it('matches nothing for a seller who is not watching', () => {
    expect(buildNotSellingSql('l')).toContain('r_ns.days IS NOT NULL');
  });

  it("reads the window from the listing's group, not from store settings", () => {
    expect(buildNotSellingSql('l')).toContain(`'coldListingDays'`);
    expect(buildNotSellingSql('l')).toContain('listing_settings_groups');
    expect(buildNotSellingSql('l')).not.toContain('store_settings');
  });
});

describe('automatic ending never goes through Trading EndItem', () => {
  it('withdraws the offer through the Inventory API', () => {
    const service = readFileSync(join(__dirname, 'listing-cleanup.service.ts'), 'utf8');
    expect(service).toContain('this.ebayBulk.withdrawOffer(');
    // The seller-triggered path (EbayService.withdrawOffer → Trading EndItem,
    // 5,000 calls a day for the whole platform) must never be what a sweep uses.
    expect(service).not.toMatch(/ebayService\.withdrawOffer|EndItem/);
  });
});
