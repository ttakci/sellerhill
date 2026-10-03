import { readFileSync } from 'fs';
import { join } from 'path';

import { ListingAutoEndReason } from '@repo/shared';

import {
  buildCleanupCandidateSql,
  buildNotSellingSql,
  cleanupSteps,
  hasCleanupWork,
  planListingCleanup,
} from './listing-cleanup.helpers';

describe('planListingCleanup', () => {
  it('ends nothing by default', () => {
    expect(hasCleanupWork(planListingCleanup(null, null))).toBe(false);
    expect(hasCleanupWork(planListingCleanup({}, {}))).toBe(false);
  });

  it('watching for not-selling listings does not end them without the second switch', () => {
    const plan = planListingCleanup(null, { coldListingDays: 90 });
    expect(plan.notSellingEndDays).toBeNull();
    expect(hasCleanupWork(plan)).toBe(false);
  });

  it('ends not-selling listings only with auto-end on', () => {
    expect(planListingCleanup(null, { coldListingDays: 90, coldListingAutoEnd: true }).notSellingEndDays).toBe(90);
  });

  it('lets a store row with its own rules override the global ones, and one without inherit them', () => {
    const global = { outOfStockEndDays: 30 };
    expect(planListingCleanup(null, global).outOfStockEndDays).toBe(30);
    expect(planListingCleanup({ outOfStockEndDays: 7 }, global).outOfStockEndDays).toBe(7);
    // A store that saved rules with the clean-up off opted out.
    expect(planListingCleanup({}, global).outOfStockEndDays).toBeNull();
  });

  it('runs the out-of-stock step before the not-selling one', () => {
    expect(
      cleanupSteps({ outOfStockEndDays: 10, notSellingEndDays: 60 }).map((step) => step.reason)
    ).toEqual([ListingAutoEndReason.OUT_OF_STOCK, ListingAutoEndReason.NOT_SELLING]);
  });
});

describe('clean-up candidate SQL', () => {
  const outOfStock = buildCleanupCandidateSql(ListingAutoEndReason.OUT_OF_STOCK);
  const notSelling = buildCleanupCandidateSql(ListingAutoEndReason.NOT_SELLING);

  it.each([outOfStock, notSelling])('only ever names an ACTIVE listing with an offer id, scoped to one store', (sql) => {
    expect(sql).toContain(`l.status = 'active'`);
    expect(sql).toContain('l.ebay_offer_id IS NOT NULL');
    expect(sql).toContain('l.user_id = $1');
    expect(sql).toContain('l.ebay_account_id = $2');
    expect(sql).toContain('auto_end_failed_at');
    expect(sql).toMatch(/LIMIT \$4::int/);
  });

  it('never ends a listing the seller paused on purpose', () => {
    expect(outOfStock).toContain('l.disable_ordering = FALSE');
    expect(outOfStock).toContain('l.lock_quantity = TRUE');
  });

  it('counts a not-selling window from creation, and looks for any order inside it', () => {
    expect(notSelling).toContain('l.created_at <= NOW() - make_interval(days => $3::int)');
    expect(notSelling).toContain('o.order_date > NOW() - make_interval(days => $3::int)');
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
