// apps/api/src/common/config/env.validation.spec.ts
//
// Regression for the KEEPA_REFRESH_INTERVAL_MINUTES class-field-default bug:
// `PlatformSettingsService.envValue()` reads `ConfigService.get(envVar)`,
// which returns whatever `validateEnv` put on the validated config —
// including a class-field default, even when the real env var was never set.
// A numeric initializer here therefore permanently shadowed the
// platform-settings registry default ('360'), so a fresh deployment with no
// env var kept seeing the old 720-minute cadence. This test would have failed
// before the fix (it asserted `undefined`, but the field was `720`).

import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('leaves KEEPA_REFRESH_INTERVAL_MINUTES undefined when the env var is not set, so the registry default applies', () => {
    const config = validateEnv({});
    expect(config.KEEPA_REFRESH_INTERVAL_MINUTES).toBeUndefined();
  });

  it('still honours an explicit override', () => {
    const config = validateEnv({ KEEPA_REFRESH_INTERVAL_MINUTES: '180' });
    expect(config.KEEPA_REFRESH_INTERVAL_MINUTES).toBe(180);
  });
});
