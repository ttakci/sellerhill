import { PlatformSettingCategory, PlatformSettingKey, PlatformSettingType } from '@repo/shared';

import {
  coerceBoolean,
  coerceNumber,
  SettingValidationError,
  validateSettingValue,
} from './platform-settings.helpers';
import type { PlatformSettingDefinition } from './platform-settings.registry';

const definition = (overrides: Partial<PlatformSettingDefinition>): PlatformSettingDefinition => ({
  key: PlatformSettingKey.KEEPA_REFRESH_ENABLED,
  category: PlatformSettingCategory.KEEPA,
  type: PlatformSettingType.BOOLEAN,
  envVar: 'KEEPA_REFRESH_ENABLED',
  defaultValue: 'true',
  ...overrides,
});

describe('validateSettingValue', () => {
  it('rejects an empty or whitespace-only value for any type', () => {
    const result = validateSettingValue(definition({ type: PlatformSettingType.STRING }), '   ');
    expect(result).toEqual({ ok: false, reason: SettingValidationError.EMPTY });
  });

  describe('boolean', () => {
    it.each(['true', 'TRUE', '1', 'yes', 'on'])('normalizes %s to "true"', (raw) => {
      expect(validateSettingValue(definition({}), raw)).toEqual({ ok: true, normalized: 'true' });
    });

    it.each(['false', 'FALSE', '0', 'no', 'off'])('normalizes %s to "false"', (raw) => {
      expect(validateSettingValue(definition({}), raw)).toEqual({ ok: true, normalized: 'false' });
    });

    it('rejects a non-boolean word', () => {
      expect(validateSettingValue(definition({}), 'maybe')).toEqual({
        ok: false,
        reason: SettingValidationError.NOT_BOOLEAN,
      });
    });
  });

  describe('number', () => {
    const numberDef = definition({ type: PlatformSettingType.NUMBER, min: 15, max: 10080 });

    it('accepts a value inside the bounds and strips whitespace', () => {
      expect(validateSettingValue(numberDef, ' 720 ')).toEqual({ ok: true, normalized: '720' });
    });

    it('accepts the exact bounds', () => {
      expect(validateSettingValue(numberDef, '15')).toEqual({ ok: true, normalized: '15' });
      expect(validateSettingValue(numberDef, '10080')).toEqual({ ok: true, normalized: '10080' });
    });

    it('rejects a value below min or above max', () => {
      expect(validateSettingValue(numberDef, '14').ok).toBe(false);
      expect(validateSettingValue(numberDef, '10081')).toEqual({
        ok: false,
        reason: SettingValidationError.OUT_OF_RANGE,
      });
    });

    it('rejects non-numeric input', () => {
      expect(validateSettingValue(numberDef, 'soon')).toEqual({
        ok: false,
        reason: SettingValidationError.NOT_NUMBER,
      });
    });
  });

  describe('enum', () => {
    const enumDef = definition({ type: PlatformSettingType.ENUM, options: ['local', 'api'] });

    it('accepts a listed option', () => {
      expect(validateSettingValue(enumDef, 'local')).toEqual({ ok: true, normalized: 'local' });
    });

    it('rejects an unlisted option', () => {
      expect(validateSettingValue(enumDef, 'smtp')).toEqual({
        ok: false,
        reason: SettingValidationError.NOT_IN_OPTIONS,
      });
    });
  });

  describe('cron', () => {
    const cronDef = definition({ type: PlatformSettingType.CRON });

    it('accepts a 5-field pattern and collapses repeated whitespace', () => {
      expect(validateSettingValue(cronDef, '*/5  *   * * *')).toEqual({
        ok: true,
        normalized: '*/5 * * * *',
      });
    });

    it('accepts a 6-field (seconds) pattern', () => {
      expect(validateSettingValue(cronDef, '0 */5 * * * *').ok).toBe(true);
    });

    it('rejects a pattern with the wrong field count', () => {
      expect(validateSettingValue(cronDef, '* * *')).toEqual({
        ok: false,
        reason: SettingValidationError.INVALID_CRON,
      });
    });
  });
});

describe('coerceBoolean', () => {
  it('returns the fallback for a null value', () => {
    expect(coerceBoolean(null, true)).toBe(true);
    expect(coerceBoolean(null, false)).toBe(false);
  });

  it('reads explicit true/false values', () => {
    expect(coerceBoolean('true', false)).toBe(true);
    expect(coerceBoolean('false', true)).toBe(false);
  });

  it('returns the fallback for an unparseable value rather than guessing', () => {
    expect(coerceBoolean('banana', true)).toBe(true);
    expect(coerceBoolean('banana', false)).toBe(false);
  });
});

describe('coerceNumber', () => {
  it('returns the fallback for null or non-numeric input', () => {
    expect(coerceNumber(null, 720)).toBe(720);
    expect(coerceNumber('abc', 720)).toBe(720);
  });

  it('parses a valid number', () => {
    expect(coerceNumber('360', 720)).toBe(360);
  });

  it('clamps to the bounds instead of propagating an out-of-range value', () => {
    expect(coerceNumber('5', 720, 15, 10080)).toBe(15);
    expect(coerceNumber('99999', 720, 15, 10080)).toBe(10080);
  });
});
