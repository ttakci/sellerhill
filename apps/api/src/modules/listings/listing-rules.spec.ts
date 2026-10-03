import {
  DEFAULT_LISTING_RULES,
  ListingRuleKind,
  evaluateListingRules,
  isAsinBlocked,
  normalizeListingRules,
  parseBlockedAsins,
  resolveListingRules,
  type ListingRulesConfig,
  type SourceQuality,
} from '@repo/shared';

import { classifyListingFailure } from './listing-failure';
import { ListingRuleBlockedError } from './listing-processor.service';

const rules = (over: Partial<ListingRulesConfig> = {}): ListingRulesConfig => ({ ...DEFAULT_LISTING_RULES, ...over });
const quality = (over: Partial<SourceQuality> = {}): SourceQuality => ({
  rating: 4.5,
  ratingCount: 200,
  isPrime: true,
  soldByAmazon: false,
  shippedByAmazon: true,
  ...over,
});
const subject = (over: Partial<Parameters<typeof evaluateListingRules>[1]> = {}) => ({
  asin: 'B000000001',
  price: 20,
  sourceQuality: quality(),
  ...over,
});

describe('normalizeListingRules', () => {
  it('reads NULL, garbage and an empty object as the defaults', () => {
    expect(normalizeListingRules(null)).toEqual(DEFAULT_LISTING_RULES);
    expect(normalizeListingRules('nope')).toEqual(DEFAULT_LISTING_RULES);
    expect(normalizeListingRules({})).toEqual(DEFAULT_LISTING_RULES);
  });

  it('keeps VeRO protection on unless it is switched off explicitly', () => {
    expect(normalizeListingRules({ veroProtectionEnabled: undefined }).veroProtectionEnabled).toBe(true);
    expect(normalizeListingRules({ veroProtectionEnabled: false }).veroProtectionEnabled).toBe(false);
  });

  it('turns out-of-range numbers off instead of storing them', () => {
    const out = normalizeListingRules({
      minSourcePrice: -5,
      maxSourcePrice: Number.NaN,
      minRating: 9,
      minReviewCount: 0,
      outOfStockEndDays: 0,
      coldListingDays: 3,
    });
    expect(out.minSourcePrice).toBeNull();
    expect(out.maxSourcePrice).toBeNull();
    expect(out.minRating).toBeNull();
    expect(out.minReviewCount).toBeNull();
    expect(out.outOfStockEndDays).toBeNull();
    expect(out.coldListingDays).toBeNull();
  });

  it('drops a maximum price below the minimum (it would refuse everything)', () => {
    const out = normalizeListingRules({ minSourcePrice: 20, maxSourcePrice: 10 });
    expect(out.minSourcePrice).toBe(20);
    expect(out.maxSourcePrice).toBeNull();
  });

  it('never keeps auto-end on while nothing is being watched', () => {
    expect(normalizeListingRules({ coldListingAutoEnd: true }).coldListingAutoEnd).toBe(false);
    expect(normalizeListingRules({ coldListingDays: 90, coldListingAutoEnd: true }).coldListingAutoEnd).toBe(true);
  });

  it('keeps a Promoted Listings ad rate only inside eBay bounds, at one decimal', () => {
    expect(normalizeListingRules({}).promotedAdRate).toBeNull();
    expect(normalizeListingRules({ promotedAdRate: 5.55 }).promotedAdRate).toBe(5.6);
    expect(normalizeListingRules({ promotedAdRate: 2 }).promotedAdRate).toBe(2);
    // eBay: "a minimum value of 2.0 and a maximum value of 100.0".
    expect(normalizeListingRules({ promotedAdRate: 1.9 }).promotedAdRate).toBeNull();
    expect(normalizeListingRules({ promotedAdRate: 100.1 }).promotedAdRate).toBeNull();
    expect(normalizeListingRules({ promotedAdRate: '5' }).promotedAdRate).toBeNull();
  });

  it('cleans the blocked ASIN list', () => {
    expect(normalizeListingRules({ blockedAsins: ['b000000001', 'B000000001', 'short', 42] }).blockedAsins).toEqual([
      'B000000001',
    ]);
  });
});

describe('parseBlockedAsins', () => {
  it('splits free text on commas, spaces and new lines', () => {
    expect(parseBlockedAsins('b000000001, B000000002\nB000000003 nope')).toEqual([
      'B000000001',
      'B000000002',
      'B000000003',
    ]);
  });
});

describe('resolveListingRules', () => {
  it('lets a store row with no rules inherit the global ones', () => {
    expect(resolveListingRules(undefined, { amazonShippedOnly: true }).amazonShippedOnly).toBe(true);
    expect(resolveListingRules({ amazonShippedOnly: false }, { amazonShippedOnly: true }).amazonShippedOnly).toBe(false);
  });
});

describe('evaluateListingRules', () => {
  it('passes everything with the defaults', () => {
    expect(evaluateListingRules(rules(), subject())).toBeNull();
  });

  it('refuses a blocked ASIN whatever its casing', () => {
    const r = rules({ blockedAsins: ['B000000001'] });
    expect(isAsinBlocked(r, 'b000000001')).toBe(true);
    expect(evaluateListingRules(r, subject())?.kind).toBe(ListingRuleKind.BLOCKED_ASIN);
  });

  it('applies the price range, and never to an unknown price', () => {
    const r = rules({ minSourcePrice: 10, maxSourcePrice: 50 });
    expect(evaluateListingRules(r, subject({ price: 9.99 }))).toEqual({
      kind: ListingRuleKind.PRICE_BELOW_MIN,
      actual: 9.99,
      limit: 10,
    });
    expect(evaluateListingRules(r, subject({ price: 50.01 }))?.kind).toBe(ListingRuleKind.PRICE_ABOVE_MAX);
    expect(evaluateListingRules(r, subject({ price: 10 }))).toBeNull();
    expect(evaluateListingRules(r, subject({ price: 0 }))).toBeNull();
  });

  it('refuses an offer Amazon does not ship, or whose shipper the page did not name', () => {
    const r = rules({ amazonShippedOnly: true });
    expect(evaluateListingRules(r, subject({ sourceQuality: quality({ shippedByAmazon: false }) }))?.kind).toBe(
      ListingRuleKind.NOT_SHIPPED_BY_AMAZON
    );
    expect(evaluateListingRules(r, subject({ sourceQuality: quality({ shippedByAmazon: null }) }))?.kind).toBe(
      ListingRuleKind.NOT_SHIPPED_BY_AMAZON
    );
    expect(evaluateListingRules(r, subject())).toBeNull();
  });

  it('refuses a low or missing rating, and too few ratings', () => {
    expect(evaluateListingRules(rules({ minRating: 4 }), subject({ sourceQuality: quality({ rating: 3.9 }) }))).toEqual({
      kind: ListingRuleKind.LOW_RATING,
      actual: 3.9,
      limit: 4,
    });
    expect(
      evaluateListingRules(rules({ minRating: 4 }), subject({ sourceQuality: quality({ rating: null }) }))?.kind
    ).toBe(ListingRuleKind.LOW_RATING);
    expect(
      evaluateListingRules(rules({ minReviewCount: 10 }), subject({ sourceQuality: quality({ ratingCount: null }) }))
    ).toEqual({ kind: ListingRuleKind.LOW_REVIEW_COUNT, actual: 0, limit: 10 });
  });

  it('passes the quality rules when the provider never captured the data', () => {
    const r = rules({ amazonShippedOnly: true, minRating: 4.5, minReviewCount: 1000 });
    expect(evaluateListingRules(r, subject({ sourceQuality: undefined }))).toBeNull();
  });
});

describe('a rule refusal as a job-item failure', () => {
  it('is terminal and carries the rule and its figures', () => {
    const failure = classifyListingFailure(
      new ListingRuleBlockedError('B000000001', { kind: ListingRuleKind.LOW_RATING, actual: 3.2, limit: 4 })
    );
    expect(failure.code).toBe('blocked_by_rule');
    expect(failure.details).toMatchObject({ retryable: false, listingRule: 'low_rating', ruleActual: 3.2, ruleLimit: 4 });
  });

  it('names the one VeRO brand that matched', () => {
    const failure = classifyListingFailure(
      new ListingRuleBlockedError('B000000001', { kind: ListingRuleKind.VERO_BRAND }, 'Roku')
    );
    expect(failure.details).toMatchObject({ listingRule: 'vero_brand', blacklistedKeyword: 'Roku' });
  });
});
