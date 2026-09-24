// Covers `@repo/shared`'s ISO 3166-1 alpha-2 code set. It lives in the shared
// package (the web country picker, the Zod schema and the API DTO all read it)
// but is exercised from here, where the Jest harness lives.

import { COUNTRY_CODES, isValidCountryCode, normalizeCountryCode } from '@repo/shared';

describe('COUNTRY_CODES', () => {
  it('carries every officially assigned code exactly once', () => {
    expect(COUNTRY_CODES).toHaveLength(249);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('is entirely two upper-case letters', () => {
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  // The one marketplace that is actually selectable today. If this ever fails,
  // every listing create on the platform is failing with it.
  it('includes US', () => {
    expect(COUNTRY_CODES).toContain('US');
  });
});

describe('normalizeCountryCode', () => {
  it('returns the canonical code for a valid input', () => {
    expect(normalizeCountryCode('US')).toBe('US');
    expect(normalizeCountryCode('tr')).toBe('TR');
    expect(normalizeCountryCode('  de  ')).toBe('DE');
  });

  // Never guess: mapping a name onto a code means owning a name table in every
  // language a seller might type, and a wrong guess ships the wrong country.
  it.each(['United States', 'Türkiye', 'Germany', 'U.S.', 'USA', 'ZZ', '', '   '])(
    'returns null for %s',
    (value) => {
      expect(normalizeCountryCode(value)).toBeNull();
    },
  );

  it('returns null for absent input', () => {
    expect(normalizeCountryCode(null)).toBeNull();
    expect(normalizeCountryCode(undefined)).toBeNull();
  });
});

describe('isValidCountryCode', () => {
  it('agrees with normalizeCountryCode', () => {
    expect(isValidCountryCode('US')).toBe(true);
    expect(isValidCountryCode('United States')).toBe(false);
    expect(isValidCountryCode(undefined)).toBe(false);
  });
});
