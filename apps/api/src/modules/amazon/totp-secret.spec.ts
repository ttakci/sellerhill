// NOTE on otplib: v13 pulls in the ESM-only `@scure/base`, which Jest's CJS
// transform cannot load. The production runtime imports otplib via
// `await import('otplib')` under Node 20 native ESM (no problem there). These
// tests cover the pure normalization helpers only — their base32 alphabet regex
// mirrors what otplib's ScureBase32Plugin accepts, so a secret that passes
// isValidTotpSecret is decodable. No need to load the real (ESM) module here.
import { isValidTotpSecret, normalizeTotpSecret } from './totp-secret';

const REAL_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

describe('normalizeTotpSecret', () => {
  it('strips the spaces Amazon puts between blocks when displaying the secret', () => {
    expect(normalizeTotpSecret('JBSWY3DP EHPK3PXP JBSWY3DP EHPK3PXP')).toBe(REAL_SECRET);
  });

  it('strips leading/trailing whitespace, tabs and newlines from a paste', () => {
    expect(normalizeTotpSecret('  \tJBSWY3DPEHPK3PXP\nJBSWY3DPEHPK3PXP \r\n')).toBe(REAL_SECRET);
  });

  it('strips hyphens and underscores used as block separators', () => {
    expect(normalizeTotpSecret('JBSWY3DP-EHPK3PXP_JBSWY3DP-EHPK3PXP')).toBe(REAL_SECRET);
  });

  it('uppercases so the stored value is canonical', () => {
    expect(normalizeTotpSecret('jbswy3dpehpk3pxp jbswy3dpehpk3pxp')).toBe(REAL_SECRET);
  });

  it('returns null for absent or whitespace-only input', () => {
    expect(normalizeTotpSecret(undefined)).toBeNull();
    expect(normalizeTotpSecret(null)).toBeNull();
    expect(normalizeTotpSecret('')).toBeNull();
    expect(normalizeTotpSecret('   ')).toBeNull();
  });

  it('leaves an already-clean secret untouched', () => {
    expect(normalizeTotpSecret(REAL_SECRET)).toBe(REAL_SECRET);
  });
});

describe('isValidTotpSecret', () => {
  it('accepts a normalized base32 secret', () => {
    expect(isValidTotpSecret(REAL_SECRET)).toBe(true);
  });

  it('accepts base32 padding', () => {
    expect(isValidTotpSecret('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PX=')).toBe(true);
  });

  it('rejects a pasted 6-digit OTP code (the common user mistake)', () => {
    expect(isValidTotpSecret(normalizeTotpSecret('123 456') ?? '')).toBe(false);
  });

  it('rejects out-of-alphabet characters (0/1/8/9, punctuation)', () => {
    expect(isValidTotpSecret('JBSWY3DPEHPK3PX0JBSWY3DPEHPK3PXP')).toBe(false);
    expect(isValidTotpSecret('JBSWY3DPEHPK3PX!JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('rejects a too-short secret', () => {
    expect(isValidTotpSecret('JBSWY3DP')).toBe(false);
  });
});
