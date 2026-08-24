// apps/api/src/modules/amazon/aquiline-profile.helpers.spec.ts
import { buildAquilineProfileId, fingerprintProfile } from './aquiline-profile.helpers';

const ADDRESS = {
  address_line1: '100 Example St',
  city: 'Example City',
  country: 'US',
};

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
  it('changes when the address changes, so the profile is PATCHed', () => {
    const before = fingerprintProfile('Store', ADDRESS);
    const after = fingerprintProfile('Store', { ...ADDRESS, city: 'Other City' });
    expect(before).not.toBe(after);
  });

  it('is stable for identical input, so no needless PATCH is issued', () => {
    expect(fingerprintProfile('Store', ADDRESS)).toBe(fingerprintProfile('Store', { ...ADDRESS }));
  });
});
