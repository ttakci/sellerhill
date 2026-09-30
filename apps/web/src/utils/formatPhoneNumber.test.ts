import { formatPhoneNumber } from '@repo/ui';
import { describe, expect, it } from 'vitest';

// eBay prints the buyer's phone as `+1 843-408-1812` on its order page and
// hands us the bare national digits on the ship-to address. The seller must
// see the same thing on both screens (first live order, 2026-09-29).
describe('formatPhoneNumber', () => {
  it('formats a bare US number the way eBay prints it', () => {
    expect(formatPhoneNumber('8434081812', 'US')).toBe('+1 843-408-1812');
  });

  it('defaults to the US when the country is unknown', () => {
    expect(formatPhoneNumber('8434081812', null)).toBe('+1 843-408-1812');
  });

  it('keeps an E.164 input and reads its own country from it', () => {
    expect(formatPhoneNumber('+905321234567', 'US')).toBe('+90 532-123-45-67');
  });

  it('returns the raw value rather than nothing when it cannot be parsed', () => {
    expect(formatPhoneNumber('call me', 'US')).toBe('call me');
  });

  it('returns an empty string for an empty input', () => {
    expect(formatPhoneNumber('', 'US')).toBe('');
    expect(formatPhoneNumber(null, 'US')).toBe('');
  });
});
