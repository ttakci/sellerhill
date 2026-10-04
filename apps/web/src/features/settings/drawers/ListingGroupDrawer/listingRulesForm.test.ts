import { DEFAULT_LISTING_RULES } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { ListingRulesDraftError } from './ListingGroupDrawer.types';
import { fromListingRulesDraft, listingRulesDraftError, toListingRulesDraft } from './listingRulesForm';

const draft = (changes: Partial<ReturnType<typeof toListingRulesDraft>> = {}) => ({
  ...toListingRulesDraft(DEFAULT_LISTING_RULES),
  ...changes,
});

describe('listing rules draft', () => {
  it('round-trips the defaults', () => {
    expect(fromListingRulesDraft(toListingRulesDraft(DEFAULT_LISTING_RULES))).toEqual(DEFAULT_LISTING_RULES);
  });

  it('reads a typed rating with a comma decimal', () => {
    expect(fromListingRulesDraft(draft({ minRating: '4,5' })).minRating).toBe(4.5);
  });

  it('reads blank fields as off', () => {
    const rules = fromListingRulesDraft(
      draft({ minRating: '', minPrice: '', maxPrice: '', minReviewCount: '', outOfStockEndDays: '' })
    );
    expect(rules.minRating).toBeNull();
    expect(rules.minSourcePrice).toBeNull();
    expect(rules.maxSourcePrice).toBeNull();
    expect(rules.minReviewCount).toBeNull();
    expect(rules.outOfStockEndDays).toBeNull();
  });

  it('refuses a rating outside 1.0-5.0', () => {
    expect(listingRulesDraftError(draft({ minRating: '6' }))).toBe(ListingRulesDraftError.MIN_RATING);
    expect(listingRulesDraftError(draft({ minRating: '0,5' }))).toBe(ListingRulesDraftError.MIN_RATING);
    expect(listingRulesDraftError(draft({ minRating: 'abc' }))).toBe(ListingRulesDraftError.MIN_RATING);
    expect(listingRulesDraftError(draft({ minRating: '4.5' }))).toBeNull();
    expect(listingRulesDraftError(draft({ minRating: '' }))).toBeNull();
  });

  it('refuses a maximum price below the minimum', () => {
    expect(listingRulesDraftError(draft({ minPrice: '20', maxPrice: '10' }))).toBe(ListingRulesDraftError.PRICE);
  });

  it('refuses a not-selling window outside the bounds while it is on', () => {
    expect(listingRulesDraftError(draft({ coldListingEnabled: true, coldListingDays: '1' }))).toBe(
      ListingRulesDraftError.COLD_DAYS
    );
    expect(listingRulesDraftError(draft({ coldListingEnabled: false, coldListingDays: '1' }))).toBeNull();
  });
});
