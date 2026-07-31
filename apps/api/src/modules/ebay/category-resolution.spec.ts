import {
  buildCategoryQuery,
  categoryQueryHash,
  isUsableLeafCategoryId,
  normalizeAmazonCategory,
  pickCategoryFromRows,
  CategoryMapScope,
  CategoryMapSource,
  type CategoryMapRow,
} from './category-resolution';

const row = (overrides: Partial<CategoryMapRow>): CategoryMapRow => ({
  scope: CategoryMapScope.QUERY,
  scopeKey: 'k',
  categoryId: '260988',
  categoryName: 'Spices',
  source: CategoryMapSource.TAXONOMY,
  isLocked: false,
  ...overrides,
});

describe('buildCategoryQuery', () => {
  it('combines brand, title and Amazon category', () => {
    expect(
      buildCategoryQuery({ brand: 'Badia', title: 'Complete Seasoning', amazonCategory: 'Grocery > Spices' })
    ).toBe('Badia Complete Seasoning Grocery > Spices');
  });

  it('skips missing parts instead of leaving gaps', () => {
    expect(buildCategoryQuery({ title: 'Complete Seasoning' })).toBe('Complete Seasoning');
  });

  it('bounds the query length', () => {
    expect(buildCategoryQuery({ title: 'x'.repeat(500) }).length).toBe(350);
  });
});

describe('categoryQueryHash', () => {
  it('is stable and case-insensitive', () => {
    expect(categoryQueryHash('Badia Seasoning')).toBe(categoryQueryHash('badia seasoning'));
  });

  it('separates different queries', () => {
    expect(categoryQueryHash('a')).not.toBe(categoryQueryHash('b'));
  });
});

describe('isUsableLeafCategoryId', () => {
  it('rejects eBay\'s root category and junk', () => {
    // Category 1 is the ROOT: listing into it always fails, and the old code
    // used it as a "safe" fallback.
    expect(isUsableLeafCategoryId('1')).toBe(false);
    expect(isUsableLeafCategoryId('')).toBe(false);
    expect(isUsableLeafCategoryId('abc')).toBe(false);
    expect(isUsableLeafCategoryId(undefined)).toBe(false);
  });

  it('accepts a real leaf id', () => {
    expect(isUsableLeafCategoryId('260988')).toBe(true);
  });
});

describe('pickCategoryFromRows', () => {
  it('prefers an operator pin over everything', () => {
    const picked = pickCategoryFromRows([
      row({ scope: CategoryMapScope.ASIN, categoryId: '111' }),
      row({ scope: CategoryMapScope.QUERY, categoryId: '222', isLocked: true }),
    ]);
    expect(picked?.categoryId).toBe('222');
  });

  it('prefers the most specific scope', () => {
    const picked = pickCategoryFromRows([
      row({ scope: CategoryMapScope.QUERY, categoryId: '222' }),
      row({ scope: CategoryMapScope.ASIN, categoryId: '111' }),
    ]);
    expect(picked?.categoryId).toBe('111');
  });

  it('prefers a curated row over a cached taxonomy answer at the same scope', () => {
    const picked = pickCategoryFromRows([
      row({ categoryId: '222' }),
      row({ categoryId: '333', source: CategoryMapSource.CURATED }),
    ]);
    expect(picked?.categoryId).toBe('333');
  });

  it('ignores unusable ids even when stored', () => {
    expect(pickCategoryFromRows([row({ categoryId: '1' })])).toBeNull();
  });

  it('returns null when there is nothing to pick', () => {
    expect(pickCategoryFromRows([])).toBeNull();
  });
});

describe('normalizeAmazonCategory', () => {
  it('normalizes whitespace and case', () => {
    expect(normalizeAmazonCategory('  Grocery  >  Spices ')).toBe('grocery > spices');
  });

  it('returns null for nothing usable', () => {
    expect(normalizeAmazonCategory('   ')).toBeNull();
    expect(normalizeAmazonCategory(undefined)).toBeNull();
  });
});
