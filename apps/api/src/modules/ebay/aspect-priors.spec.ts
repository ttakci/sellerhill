import type { CategoryAspect } from './aspect-builder';
import { pickPriorValue, pickTerminalValue, pickValueFromText } from './aspect-priors';

const freeText = (name: string): CategoryAspect => ({
  name,
  required: true,
  selectionOnly: false,
  multiValue: false,
  values: [],
});

const selection = (name: string, values: string[]): CategoryAspect => ({
  name,
  required: true,
  selectionOnly: true,
  multiValue: false,
  values,
});

describe('pickValueFromText', () => {
  it('finds an allowed value the product text mentions', () => {
    expect(pickValueFromText(selection('Color', ['Black', 'Blue']), 'Zero Gravity Chair Cord, Black')).toBe('Black');
  });

  it('prefers the most specific match', () => {
    const aspect = selection('Department', ['Adult', 'Unisex Adult', 'Boys']);
    expect(pickValueFromText(aspect, 'Chair for Unisex Adult use')).toBe('Unisex Adult');
  });

  it('ignores very short values that would match by accident', () => {
    expect(pickValueFromText(selection('Size', ['S', 'M', 'L']), 'Massive Storage Set')).toBeNull();
  });
});

describe('pickPriorValue', () => {
  it('falls back to the aspect hint table when the text says nothing', () => {
    const aspect = selection('Department', ['Boys', 'Girls', 'Unisex Adult']);
    expect(pickPriorValue(aspect, 'Complete Seasoning 6 oz')).toBe('Unisex Adult');
  });

  it('returns null for an aspect it has no knowledge of', () => {
    expect(pickPriorValue(selection('Shoe Width', ['B', 'D', 'EE']), 'Complete Seasoning')).toBeNull();
  });
});

describe('pickTerminalValue — the guarantee', () => {
  it('uses eBay\'s own non-value when the category offers one', () => {
    expect(pickTerminalValue(selection('MPN', ['Does Not Apply', 'Custom Bundle']))).toBe('Does Not Apply');
  });

  it('prefers a catch-all over an arbitrary specific value', () => {
    expect(pickTerminalValue(selection('Department', ['Boys', 'Girls', 'Unisex Adult']))).toBe('Unisex Adult');
  });

  it('avoids values that assert a measurement', () => {
    // "One Size" would be a catch-all; without it, never claim "12-18 Months".
    expect(pickTerminalValue(selection('Size', ['12-18 Months', 'Regular', '3/4 Length']))).toBe('Regular');
  });

  it('falls back to Does not apply for free-text aspects', () => {
    expect(pickTerminalValue(freeText('Screen Size'))).toBe('Does not apply');
  });

  it('uses Unbranded for a free-text Brand', () => {
    expect(pickTerminalValue(freeText('Brand'))).toBe('Unbranded');
  });

  it('is deterministic', () => {
    const aspect = selection('Theme', ['Sport', 'Nautical', 'Floral']);
    expect(pickTerminalValue(aspect)).toBe(pickTerminalValue(aspect));
  });

  /**
   * The invariant the whole design rests on: whatever shape eBay declares, a
   * required aspect always gets a value, so a listing can never die on a
   * missing item specific.
   */
  it('always returns a value for every category shape', () => {
    const shapes: CategoryAspect[] = [
      freeText('Anything'),
      selection('Empty', []),
      selection('Single', ['Only Option']),
      selection('Numeric only', ['12-18 Months', '3/4 Length']),
      selection('Many', ['Alpha', 'Beta', 'Gamma']),
      selection('With non-value', ['Alpha', 'Unspecified']),
    ];

    for (const aspect of shapes) {
      const value = pickTerminalValue(aspect);
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      if (aspect.selectionOnly && aspect.values.length > 0) {
        expect(aspect.values).toContain(value);
      }
    }
  });
});
