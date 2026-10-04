import {
  DEFAULT_LISTING_RULES,
  ListingRuleKind,
  evaluateListingRules,
  isAsinBlocked,
  normalizeListingRules,
  normalizeMinRating,
  parseBlockedAsins,
  resolveBlockedAsins,
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

  it('keeps the brand away from eBay unless the seller switches that off', () => {
    expect(DEFAULT_LISTING_RULES.hideBrand).toBe(true);
    expect(normalizeListingRules({ hideBrand: undefined }).hideBrand).toBe(true);
    expect(normalizeListingRules({ hideBrand: 'yes' }).hideBrand).toBe(true);
    expect(normalizeListingRules({ hideBrand: false }).hideBrand).toBe(false);
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

  it('no longer carries the ad rate or the blocked list (they live elsewhere since 2026-10-04)', () => {
    const normalized = normalizeListingRules({ promotedAdRate: 5, blockedAsins: ['B000000001'] }) as unknown as Record<string, unknown>;
    expect('promotedAdRate' in normalized).toBe(false);
    expect('blockedAsins' in normalized).toBe(false);
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

describe('normalizeMinRating', () => {
  it.each([
    [4.5, 4.5], ['4,5', 4.5], ['4.55', 4.6], [1, 1], [5, 5],
    [0.9, null], [5.1, null], ['', null], ['abc', null], [null, null],
  ])('%p → %p', (input, expected) => {
    expect(normalizeMinRating(input)).toBe(expected);
  });
  it('normalizeListingRules uses it', () => {
    expect(normalizeListingRules({ minRating: '3,5' }).minRating).toBe(3.5);
  });
});

describe('resolveBlockedAsins', () => {
  it('store list wins, an explicit empty store list blocks nothing', () => {
    expect(resolveBlockedAsins(['B0AAAAAAAA'], ['B0BBBBBBBB'])).toEqual(['B0AAAAAAAA']);
    expect(resolveBlockedAsins([], ['B0BBBBBBBB'])).toEqual([]);
  });
  it('a NULL store list inherits the global one; no list at all is none', () => {
    expect(resolveBlockedAsins(null, ['B0BBBBBBBB'])).toEqual(['B0BBBBBBBB']);
    expect(resolveBlockedAsins(null, null)).toEqual([]);
  });
});

describe('evaluateListingRules', () => {
  it('passes everything with the defaults', () => {
    expect(evaluateListingRules(rules(), subject())).toBeNull();
  });

  it('a blocked ASIN is matched whatever its casing (the worker checks the list itself)', () => {
    expect(isAsinBlocked(['B000000001'], 'b000000001')).toBe(true);
    expect(isAsinBlocked([], 'B000000001')).toBe(false);
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
