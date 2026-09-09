import { containsBlacklistedKeyword } from './listing-blacklist';

describe('containsBlacklistedKeyword', () => {
  // The bug this module exists to kill. `String.includes` matched a keyword
  // anywhere inside a longer word, so a seller's "Gin" rejected every product
  // whose copy said "packaging" — a word no human would connect to the rule.
  describe('never matches inside a longer word', () => {
    it.each([
      ['gin', 'Retail packaging included'],
      ['gin', 'Fast charging cable'],
      ['gin', 'Original manufacturer part'],
      ['gin', 'Engine oil filter'],
      ['rum', 'Vitamin C brightening serum'],
      ['rum', 'Snare drum practice pad'],
      ['rum', 'Full spectrum LED panel'],
      ['cross', 'Fits across all standard mounts'],
      ['amazon', 'https://images-na.ssl-images-amazon.com/images/I/71x.jpg'],
    ])('keyword %j does not match %j', (keyword, text) => {
      expect(containsBlacklistedKeyword([text], keyword)).toBe(false);
    });
  });

  describe('matches the standalone word', () => {
    it.each([
      ['gin', 'Bombay Sapphire gin 700ml'],
      ['rum', 'Captain Morgan rum bottle'],
      ['cross', 'Silver cross pendant'],
      ['amazon', 'Ships from Amazon warehouses'],
    ])('keyword %j matches %j', (keyword, text) => {
      expect(containsBlacklistedKeyword([text], keyword)).toBe(true);
    });

    it('matches at the very start and the very end of the text', () => {
      expect(containsBlacklistedKeyword(['Cross body strap'], 'cross')).toBe(true);
      expect(containsBlacklistedKeyword(['Made by Amazon'], 'amazon')).toBe(true);
    });
  });

  // Operator decision (2026-09-08): a seller blacklisting `cross` means the
  // standalone word, not a compound. `-` and `/` therefore count as word
  // characters, so the compound does NOT match.
  describe('hyphen and slash are word characters, not boundaries', () => {
    it.each([
      ['cross', 'Premium cross-body messenger bag'],
      ['cross', 'Cross/over training shoe'],
      ['cross', 'A crossbody bag'],
    ])('keyword %j does not match compound %j', (keyword, text) => {
      expect(containsBlacklistedKeyword([text], keyword)).toBe(false);
    });

    it('still matches a hyphenated keyword the seller typed in full', () => {
      expect(containsBlacklistedKeyword(['Premium cross-body bag'], 'cross-body')).toBe(true);
    });
  });

  // Ordinary punctuation stays a boundary — a seller blacklisting `amazon`
  // absolutely means to catch these.
  describe('ordinary punctuation is still a boundary', () => {
    it.each([
      ['amazon', "Amazon's Choice for kitchen"],
      ['amazon', 'Visit amazon.com for details'],
      ['amazon', 'Sold by (Amazon), shipped fast'],
      ['amazon', 'Fulfilled by Amazon.'],
    ])('keyword %j matches %j', (keyword, text) => {
      expect(containsBlacklistedKeyword([text], keyword)).toBe(true);
    });
  });

  describe('case insensitivity is preserved', () => {
    it.each(['amazon', 'Amazon', 'AMAZON', 'aMaZoN'])('keyword %j matches mixed-case text', (keyword) => {
      expect(containsBlacklistedKeyword(['Ships from AMAZON today'], keyword)).toBe(true);
    });

    it('matches an all-caps title, which eBay copy is full of', () => {
      expect(containsBlacklistedKeyword(['ORIGINAL OEM REPLACEMENT PART'], 'original')).toBe(true);
    });
  });

  describe('multi-word keywords', () => {
    it('matches a phrase keyword', () => {
      expect(containsBlacklistedKeyword(['Genuine Amazon Basics cable'], 'amazon basics')).toBe(true);
    });

    it('does not match a phrase whose last word is only a prefix', () => {
      expect(containsBlacklistedKeyword(['Amazon basically ships it'], 'amazon basic')).toBe(false);
    });
  });

  describe('regex metacharacters in a keyword are literal', () => {
    it('treats a dot as a dot, not as "any character"', () => {
      expect(containsBlacklistedKeyword(['Visit amazon.com'], 'amazon.com')).toBe(true);
      expect(containsBlacklistedKeyword(['Visit amazonXcom'], 'amazon.com')).toBe(false);
    });

    it('does not throw on an unbalanced bracket', () => {
      expect(() => containsBlacklistedKeyword(['anything'], 'c++ (unbalanced [')).not.toThrow();
    });
  });

  describe('scans every supplied value', () => {
    it('matches when the keyword is in a later value', () => {
      expect(containsBlacklistedKeyword(['clean', 'clean', 'contains rum'], 'rum')).toBe(true);
    });

    it('is false for an empty value list', () => {
      expect(containsBlacklistedKeyword([], 'rum')).toBe(false);
    });

    it('ignores empty and whitespace-only keywords', () => {
      expect(containsBlacklistedKeyword(['anything at all'], '')).toBe(false);
      expect(containsBlacklistedKeyword(['anything at all'], '   ')).toBe(false);
    });
  });
});
