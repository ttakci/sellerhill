import { autofillRate, normalizeAspectKey, validateCuratedAspectValue } from './listing-quality.helpers';

const aspects = [
  { name: 'Department', selectionOnly: true, values: ['Boys', 'Girls', 'Unisex Adult'] },
  { name: 'Item Form', selectionOnly: false, values: [] },
];

describe('normalizeAspectKey', () => {
  it('matches the aspect builder\'s normalization', () => {
    expect(normalizeAspectKey('Item Weight')).toBe('itemweight');
    expect(normalizeAspectKey('MPN')).toBe('mpn');
  });
});

describe('validateCuratedAspectValue', () => {
  it('accepts an allowed value regardless of case', () => {
    expect(validateCuratedAspectValue(aspects, 'Department', 'unisex adult')).toBeNull();
  });

  it('rejects a value the category does not accept', () => {
    // Without this the admin panel would become a NEW source of publish
    // failures — the exact class of bug this feature removes.
    const problem = validateCuratedAspectValue(aspects, 'Department', 'Toddlers');
    expect(problem).toContain('not an accepted value');
    expect(problem).toContain('Unisex Adult');
  });

  it('allows any text for a free-text aspect', () => {
    expect(validateCuratedAspectValue(aspects, 'Item Form', 'Rolled')).toBeNull();
  });

  it('allows an aspect the cached taxonomy does not know', () => {
    expect(validateCuratedAspectValue(aspects, 'Brand New Aspect', 'Anything')).toBeNull();
  });

  it('requires a value', () => {
    expect(validateCuratedAspectValue(aspects, 'Department', '   ')).toBe('Value is required');
  });
});

describe('autofillRate', () => {
  it('reports one decimal place', () => {
    expect(autofillRate(200, 15)).toBe(7.5);
  });

  it('is zero when nothing was analyzed', () => {
    expect(autofillRate(0, 0)).toBe(0);
  });
});
