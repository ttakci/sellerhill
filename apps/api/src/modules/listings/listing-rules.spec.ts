import {
  DEFAULT_LISTING_RULES,
  ListingRuleKind,
  evaluateListingRules,
  findEpaRegistrationNumber,
  isAsinBlocked,
  looksLikePesticide,
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

describe('Prime-only rule', () => {
  it('refuses an offer the page shows is not Prime-eligible, or that showed no promise at all', () => {
    expect(evaluateListingRules(rules({ primeOnly: true }), subject({ sourceQuality: quality({ primeEligible: false }) }))).toEqual({
      kind: ListingRuleKind.NOT_PRIME,
    });
    expect(evaluateListingRules(rules({ primeOnly: true }), subject({ sourceQuality: quality({ primeEligible: null }) }))?.kind).toBe(
      ListingRuleKind.NOT_PRIME
    );
  });

  it('passes a Prime-eligible offer, and a row read before eligibility was captured', () => {
    expect(evaluateListingRules(rules({ primeOnly: true }), subject({ sourceQuality: quality({ primeEligible: true }) }))).toBeNull();
    // Cached rows carry upstream's unreliable isPrime:false but no primeEligible.
    expect(evaluateListingRules(rules({ primeOnly: true }), subject({ sourceQuality: quality({ isPrime: false }) }))).toBeNull();
  });

  it('is off by default', () => {
    expect(DEFAULT_LISTING_RULES.primeOnly).toBe(false);
    expect(normalizeListingRules({ primeOnly: 'yes' }).primeOnly).toBe(false);
    expect(normalizeListingRules({ primeOnly: true }).primeOnly).toBe(true);
  });
});

describe('pesticide protection', () => {
  it('is on unless switched off', () => {
    expect(DEFAULT_LISTING_RULES.pesticideProtection).toBe(true);
    expect(normalizeListingRules({}).pesticideProtection).toBe(true);
    expect(normalizeListingRules({ pesticideProtection: false }).pesticideProtection).toBe(false);
  });

  it.each([
    'Ortho Home Defense Insect Killer Spray 24 oz',
    'Roundup Weed and Grass Killer Concentrate',
    'Natural Mosquito Repellent Spray for Kids',
    'Clorox Disinfecting Wipes 75 Count',
    'Pool Shock 1 lb Bags 12 Pack',
    'Chlorine Tablets 3 Inch 25 lb',
    'Flea and Tick Collar for Dogs',
    'Rat Poison Bait Blocks',
    'Broad Spectrum Fungicide Concentrate',
  ])('reads "%s" as a pesticide', (title) => {
    expect(looksLikePesticide(title, '')).toBe(true);
  });

  it.each([
    ['Snap Mouse Traps Reusable 12 Pack', 'Patio, Lawn & Garden > Pest Control > Traps'],
    ['Electric Fly Swatter Racket', 'Patio, Lawn & Garden > Pest Control'],
    ['Mens Slippers Memory Foam', 'Clothing, Shoes & Jewelry > Men > Shoes'],
    ['Weed Wacker Trimmer Line', 'Patio, Lawn & Garden'],
    ['Bug Out Bag Backpack', 'Sports & Outdoors'],
  ])('does not read "%s" as a pesticide', (title, path) => {
    expect(looksLikePesticide(title, path)).toBe(false);
  });

  it('reads a pesticide category path even when the title says nothing', () => {
    expect(looksLikePesticide('Outdoor Lotion 6 oz', 'Health & Household > Insect Repellents')).toBe(true);
  });

  it.each([
    ['EPA Reg. No. 239-2686', '239-2686'],
    ['EPA Registration Number: 1021-1687-8329', '1021-1687-8329'],
    ['epa reg #432-1544', '432-1544'],
    ['<b>EPA Reg. No.</b> 5481-9', '5481-9'],
  ])('finds the EPA registration number in "%s"', (text, expected) => {
    expect(findEpaRegistrationNumber([text])).toBe(expected);
  });

  it('does not take an EPA establishment number for a registration', () => {
    expect(findEpaRegistrationNumber(['EPA Est. No. 1234-TX-1'])).toBeNull();
  });

  it('refuses a pesticide with no EPA number and lists one that prints it', () => {
    const pest = { title: 'Ant Killer Bait Stations 4 Pack', categoryPath: 'Patio, Lawn & Garden > Pest Control' };
    expect(evaluateListingRules(rules(), subject({ ...pest, copy: ['Kills ants fast'] }))).toEqual({
      kind: ListingRuleKind.PESTICIDE_NO_EPA,
    });
    expect(evaluateListingRules(rules(), subject({ ...pest, copy: ['Kills ants fast', 'EPA Reg. No. 12455-79'] }))).toBeNull();
    expect(evaluateListingRules(rules({ pesticideProtection: false }), subject({ ...pest, copy: [] }))).toBeNull();
  });

  it('judges pesticides even when no source quality was captured (Keepa)', () => {
    expect(
      evaluateListingRules(rules(), subject({ title: 'Wasp Killer Spray', sourceQuality: undefined, copy: [] }))?.kind
    ).toBe(ListingRuleKind.PESTICIDE_NO_EPA);
  });
});
