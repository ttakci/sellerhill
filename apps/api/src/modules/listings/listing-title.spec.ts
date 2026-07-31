import {
  ensureBrandPrefix,
  expandTitleWithSourceKeywords,
  extractIdentifierTokens,
  isTitleRewriteAcceptable,
  normalizeTitleWhitespace,
  stripBrandFromTitle,
  truncateTitleAtWordBoundary,
} from './listing-title';

describe('normalizeTitleWhitespace', () => {
  it('collapses whitespace and strips control characters', () => {
    expect(normalizeTitleWhitespace('Fruit\nRoll-Ups\t Variety  Pack')).toBe('Fruit Roll-Ups Variety Pack');
  });
});

describe('truncateTitleAtWordBoundary', () => {
  it('leaves short titles untouched', () => {
    expect(truncateTitleAtWordBoundary('Short title', 80)).toBe('Short title');
  });

  it('cuts at a word boundary instead of mid-word', () => {
    const title =
      'Fruit Roll-Ups, Fruit by the Foot and Gushers Fruit Flavored Snacks Variety Pack, Gluten Free, 16 Pouches';
    const result = truncateTitleAtWordBoundary(title, 80);

    expect(result.length).toBeLessThanOrEqual(80);
    expect(title.startsWith(result)).toBe(true);
    expect(result.endsWith('Pouc')).toBe(false);
  });

  it('drops a dangling separator', () => {
    expect(truncateTitleAtWordBoundary('Alpha Beta Gamma, Delta', 18)).toBe('Alpha Beta Gamma');
  });

  it('still truncates a single oversized word', () => {
    const long = 'A'.repeat(120);
    expect(truncateTitleAtWordBoundary(long, 80)).toHaveLength(80);
  });
});

describe('stripBrandFromTitle', () => {
  it('removes a leading brand with its separator', () => {
    expect(stripBrandFromTitle('BISSELL - Portable Carpet Cleaner', 'BISSELL')).toBe('Portable Carpet Cleaner');
  });

  it('removes whole-word occurrences anywhere', () => {
    expect(stripBrandFromTitle('Portable BISSELL Carpet Cleaner', 'BISSELL')).toBe('Portable Carpet Cleaner');
  });

  it('keeps the original when stripping would empty it', () => {
    expect(stripBrandFromTitle('BISSELL', 'BISSELL')).toBe('BISSELL');
  });
});

describe('extractIdentifierTokens', () => {
  it('finds model numbers and sized tokens', () => {
    expect(extractIdentifierTokens('BISSELL Little Green Carpet Cleaner, 1400B 48oz')).toEqual(
      expect.arrayContaining(['1400B', '48oz'])
    );
  });

  it('ignores plain words and bare numbers', () => {
    expect(extractIdentifierTokens('Portable Carpet Cleaner 16')).toEqual([]);
  });
});

describe('isTitleRewriteAcceptable', () => {
  const base = 'BISSELL Little Green Multi-Purpose Portable Carpet Cleaner, 1400B';

  it('rejects a rewrite that throws away the character budget', () => {
    // Observed live: 65 chars of source became 36, losing "Little Green",
    // "Multi-Purpose" AND the 1400B model number buyers search by.
    expect(isTitleRewriteAcceptable('BISSELL Portable Carpet Cleaner 48oz', base)).toBe(false);
  });

  it('rejects a rewrite that drops every identifier', () => {
    expect(
      isTitleRewriteAcceptable('Little Green Multi Purpose Portable Deep Carpet Cleaner Machine', base)
    ).toBe(false);
  });

  it('accepts a full-length rewrite that keeps the model number', () => {
    expect(
      isTitleRewriteAcceptable('Little Green Multi-Purpose Portable Carpet Cleaner 1400B 48oz Tank', base)
    ).toBe(true);
  });

  it('accepts anything reasonable when the source has no identifiers', () => {
    expect(isTitleRewriteAcceptable('Complete Seasoning All Purpose Spice Blend', 'Badia Complete Seasoning')).toBe(
      true
    );
  });

  it('still rejects an empty-ish answer', () => {
    expect(isTitleRewriteAcceptable('ok', base)).toBe(false);
  });
});

describe('expandTitleWithSourceKeywords', () => {
  const source =
    'HiBREW G5 Electric Burr Coffee Grinder, Aluminum Body, Single Dose, Black | ' +
    '48mm Conical Burr with Dual Speed, 36 Grind Levels,50g Bean Capacity';

  it('fills the unused budget with source keywords', () => {
    // Small local models answer far under 80 characters; the packer reclaims
    // the lost search surface instead of fighting the model with prompts.
    const packed = expandTitleWithSourceKeywords('G5 Electric Burr Coffee Grinder', source, 80);

    expect(packed.length).toBeGreaterThan(60);
    expect(packed.length).toBeLessThanOrEqual(80);
  });

  it('prioritises identifiers over descriptive phrases', () => {
    const packed = expandTitleWithSourceKeywords('Electric Burr Coffee Grinder Single Dose Black', source, 80);
    expect(packed).toMatch(/48mm/);
  });

  it('appends whole phrases rather than word salad', () => {
    // Word-by-word packing produced "... 40-Count Lead Resists Bulk"; a phrase
    // reads like a title a seller would actually write.
    const bic =
      'BIC Xtra-Smooth Mechanical Pencils, 0.7 mm Medium Point, 40-Count | No. 2 Lead Resists ' +
      'Smudging and Erases Cleanly, Smooth Reliable Writing, Pastel Barrels, Bulk Pack for Students';
    const packed = expandTitleWithSourceKeywords(
      'Xtra-Smooth Mechanical Pencils, 0.7 mm Medium Point, 40-Count',
      bic,
      80,
      'BIC'
    );

    expect(packed).toContain('Pastel Barrels');
    expect(packed.length).toBeGreaterThan(70);
  });

  it('still uses single words when no phrase fits', () => {
    const short = 'BISSELL Little Green Multi-Purpose Portable Carpet Cleaner, 1400B';
    const packed = expandTitleWithSourceKeywords('Portable Carpet Cleaner 48oz', short, 80, 'BISSELL');

    expect(packed).toMatch(/1400B/);
    expect(packed).toMatch(/Little/);
  });

  it('splits tokens Amazon glued to punctuation', () => {
    // Source says "Levels,50g" — appending that verbatim publishes a glued token.
    const packed = expandTitleWithSourceKeywords('Coffee Grinder', source, 80);
    expect(packed).not.toMatch(/Levels,50g/);
  });

  it('never repeats information the model already wrote', () => {
    const packed = expandTitleWithSourceKeywords('Bio-Collagen Real Deep Mask', 'BIODANCE Bio Collagen Real Deep Mask Hydrating', 80);
    // "Bio-Collagen" and "Bio Collagen" are the same words with different punctuation.
    expect(packed.toLowerCase().match(/collagen/g)).toHaveLength(1);
  });

  it('honours the removed brand', () => {
    const packed = expandTitleWithSourceKeywords('Electric Burr Coffee Grinder', source, 80, 'HiBREW');
    expect(packed).not.toMatch(/HiBREW/i);
  });

  it('drops bare numbers, which carry no search value alone', () => {
    const packed = expandTitleWithSourceKeywords('Coffee Grinder Single Dose Black Aluminum Body Conical Burr', source, 80);
    expect(packed).not.toMatch(/\s36$/);
  });

  it('leaves an already-full title untouched', () => {
    const full = 'A'.repeat(80);
    expect(expandTitleWithSourceKeywords(full, source, 80)).toBe(full);
  });
});

describe('ensureBrandPrefix', () => {
  it('puts a dropped brand back at the front, not the end', () => {
    // The keyword packer would otherwise append it: "... Pastel Barrels BIC".
    expect(ensureBrandPrefix('Xtra-Smooth Mechanical Pencils 40-Count', 'BIC')).toBe(
      'BIC Xtra-Smooth Mechanical Pencils 40-Count'
    );
  });

  it('leaves a title that already names the brand alone', () => {
    const title = 'BIC Xtra-Smooth Mechanical Pencils';
    expect(ensureBrandPrefix(title, 'BIC')).toBe(title);
  });

  it('ignores punctuation differences when checking presence', () => {
    const title = 'Bio-Collagen Real Deep Mask by BIODANCE';
    expect(ensureBrandPrefix(title, 'BIODANCE')).toBe(title);
  });

  it('does nothing when the brand would not fit', () => {
    const title = 'A'.repeat(78);
    expect(ensureBrandPrefix(title, 'BIC', 80)).toBe(title);
  });

  it('does nothing without a brand', () => {
    expect(ensureBrandPrefix('Some title', undefined)).toBe('Some title');
  });
});
