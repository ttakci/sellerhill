// apps/api/src/modules/admin/platform-settings.helpers.ts
//
// Pure coercion + validation for runtime settings. No I/O — every rule about
// what a setting value may be lives here and is unit-tested, so the write path
// (admin PUT) and the read path (resolve DB/env/default) can never disagree.

import { PlatformSettingType } from '@repo/shared';

import type { PlatformSettingDefinition } from './platform-settings.registry';

/** Outcome of validating a raw string against a registry entry. */
export type SettingValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: SettingValidationError };

/** Machine-readable rejection reason (mapped to an i18n key at the boundary). */
export enum SettingValidationError {
  EMPTY = 'empty',
  NOT_BOOLEAN = 'notBoolean',
  NOT_NUMBER = 'notNumber',
  OUT_OF_RANGE = 'outOfRange',
  NOT_IN_OPTIONS = 'notInOptions',
  INVALID_CRON = 'invalidCron',
}

const TRUE_VALUES = ['true', '1', 'yes', 'on'];
const FALSE_VALUES = ['false', '0', 'no', 'off'];

/**
 * Validate + normalize a raw setting value against its definition.
 *
 * Normalization matters: booleans collapse to 'true'/'false' and numbers drop
 * stray whitespace, so a value written through the admin panel is byte-identical
 * to one supplied via env and `coerce*` never has to special-case either origin.
 */
export function validateSettingValue(
  definition: PlatformSettingDefinition,
  raw: string,
): SettingValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: SettingValidationError.EMPTY };
  }

  switch (definition.type) {
    case PlatformSettingType.BOOLEAN: {
      const lower = trimmed.toLowerCase();
      if (TRUE_VALUES.includes(lower)) {return { ok: true, normalized: 'true' };}
      if (FALSE_VALUES.includes(lower)) {return { ok: true, normalized: 'false' };}
      return { ok: false, reason: SettingValidationError.NOT_BOOLEAN };
    }
    case PlatformSettingType.NUMBER: {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) {
        return { ok: false, reason: SettingValidationError.NOT_NUMBER };
      }
      if (definition.min !== undefined && num < definition.min) {
        return { ok: false, reason: SettingValidationError.OUT_OF_RANGE };
      }
      if (definition.max !== undefined && num > definition.max) {
        return { ok: false, reason: SettingValidationError.OUT_OF_RANGE };
      }
      return { ok: true, normalized: String(num) };
    }
    case PlatformSettingType.ENUM: {
      const options = definition.options ?? [];
      if (!options.includes(trimmed)) {
        return { ok: false, reason: SettingValidationError.NOT_IN_OPTIONS };
      }
      return { ok: true, normalized: trimmed };
    }
    case PlatformSettingType.CRON: {
      // BullMQ uses 5- or 6-field patterns (the 6th being seconds).
      const fields = trimmed.split(/\s+/);
      if (fields.length !== 5 && fields.length !== 6) {
        return { ok: false, reason: SettingValidationError.INVALID_CRON };
      }
      return { ok: true, normalized: fields.join(' ') };
    }
    case PlatformSettingType.STRING:
    default:
      return { ok: true, normalized: trimmed };
  }
}

/**
 * Coerce a resolved string to boolean. Only explicit false-ish values are
 * false — this mirrors the pre-existing env semantics where any value other
 * than the literal 'false' kept a flag on.
 */
export function coerceBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {return fallback;}
  const lower = value.trim().toLowerCase();
  if (TRUE_VALUES.includes(lower)) {return true;}
  if (FALSE_VALUES.includes(lower)) {return false;}
  return fallback;
}

/**
 * Coerce a resolved string to a number, clamped to the definition's bounds.
 * A non-numeric value falls back rather than propagating NaN into a query.
 */
export function coerceNumber(
  value: string | null,
  fallback: number,
  min?: number,
  max?: number,
): number {
  if (value === null) {return fallback;}
  const num = Number(value.trim());
  if (!Number.isFinite(num)) {return fallback;}
  if (min !== undefined && num < min) {return min;}
  if (max !== undefined && num > max) {return max;}
  return num;
}
