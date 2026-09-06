// Covers the shared derivations in `@repo/shared`'s store-settings helpers.
// They live in the shared package (both the web drawer and two API services
// read them) but are exercised from here, where the Jest harness lives.

import { buildStoreStreetLine, isStoreAddressComplete } from '@repo/shared';

describe('buildStoreStreetLine', () => {
  // Both providers require a street and SellerHill collects none, so one is
  // derived. The value that shipped before this was the literal placeholder
  // 'Use Store Address', which reached eBay as every seller's real street.
  it('joins city and region into a street line', () => {
    expect(buildStoreStreetLine({ city: 'Sheridan', state: 'WY' })).toBe('Sheridan, WY');
  });

  it('drops a missing part rather than leaving a dangling separator', () => {
    expect(buildStoreStreetLine({ city: 'Sheridan', state: '  ' })).toBe('Sheridan');
    expect(buildStoreStreetLine({ city: null, state: 'WY' })).toBe('WY');
  });

  it('returns an empty string when neither part is present', () => {
    expect(buildStoreStreetLine({})).toBe('');
    expect(buildStoreStreetLine({ city: '', state: null })).toBe('');
  });

  it('trims each part', () => {
    expect(buildStoreStreetLine({ city: '  Sheridan ', state: ' WY  ' })).toBe('Sheridan, WY');
  });
});

describe('isStoreAddressComplete', () => {
  const complete = { country: 'US', state: 'WY', city: 'Sheridan', zipCode: '82801' };

  it('accepts all four fields', () => {
    expect(isStoreAddressComplete(complete)).toBe(true);
  });

  // eBay refuses a STORE inventory location without the full set, and the
  // tracking provider refuses a profile without street/city/country — so every
  // one of the four is load-bearing for at least one consumer.
  it.each(['country', 'state', 'city', 'zipCode'] as const)('rejects a missing %s', (field) => {
    expect(isStoreAddressComplete({ ...complete, [field]: '' })).toBe(false);
    expect(isStoreAddressComplete({ ...complete, [field]: '   ' })).toBe(false);
    expect(isStoreAddressComplete({ ...complete, [field]: null })).toBe(false);
  });

  // A complete address always yields a non-empty derived street, which is what
  // lets the provider path treat "complete" as sufficient on its own.
  it('guarantees a derivable street line whenever it reports complete', () => {
    expect(buildStoreStreetLine(complete)).not.toBe('');
  });
});
