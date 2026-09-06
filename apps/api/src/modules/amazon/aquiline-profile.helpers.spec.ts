// apps/api/src/modules/amazon/aquiline-profile.helpers.spec.ts
import { buildAquilineProfileId, fingerprintProfile } from './aquiline-profile.helpers';

describe('buildAquilineProfileId', () => {
  it('is deterministic, so a crashed creation is recoverable', () => {
    const a = buildAquilineProfileId('sh', 'u-1', 'AMAZON_US');
    const b = buildAquilineProfileId('sh', 'u-1', 'AMAZON_US');
    expect(a).toBe(b);
    expect(a).toBe('sh-u-1-AMAZON_US');
  });

  it('separates environments, because one account serves them all', () => {
    expect(buildAquilineProfileId('sh-dev', 'u-1', 'AMAZON_US')).not.toBe(
      buildAquilineProfileId('sh', 'u-1', 'AMAZON_US'),
    );
  });
});

describe('fingerprintProfile', () => {
  it('changes when the label changes, so the profile is PATCHed', () => {
    expect(fingerprintProfile('Store')).not.toBe(fingerprintProfile('Other Store'));
  });

  it('is stable for identical input, so no needless PATCH is issued', () => {
    expect(fingerprintProfile('Store')).toBe(fingerprintProfile('Store'));
  });

  // The address is deliberately NOT an input any more — the provider stores
  // `storeAddress: null` happily (verified live 2026-09-02) and we stopped
  // sending one. A fingerprint that still moved with the seller's address
  // would PATCH the profile to push a field we no longer include.
  it('does not depend on the seller address', () => {
    expect(fingerprintProfile.length).toBe(1);
  });
});
