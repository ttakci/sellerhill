import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min';

/** Sensible fallback when neither the stored value nor the caller names a country. */
export const DEFAULT_COUNTRY: CountryCode = 'US';

/**
 * ISO 3166-1 alpha-2 → regional-indicator flag emoji. Pure, no assets:
 * 'T' (U+0054) → U+1F1F9, 'R' → U+1F1F7, together render as 🇹🇷.
 */
export const flagEmoji = (iso: string): string =>
  iso
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));

/** Localized country name via the browser, falling back to the ISO code itself. */
export const regionName = (iso: string, locale: string): string => {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? iso;
  } catch {
    return iso;
  }
};

export interface CountryOption {
  /** ISO 3166-1 alpha-2 — the picker's value. */
  value: CountryCode;
  /** What the picker renders (and filters search against). */
  label: string;
  /** e.g. "90" — kept separate so the trigger/input can show "+90". */
  callingCode: string;
  /** Localized name without the dial code — for sorting and search. */
  name: string;
}

/**
 * One option per usable country, `United States (+1)`, sorted alphabetically by
 * localized name. No flag emoji — Windows renders regional-indicator pairs as
 * bare letters (`US United States +1`), which reads like a stray code. Single
 * flat list, no pinned/"preferred" block: the picker already opens on the
 * caller's `defaultCountry`, `Select` has no divider to set a pinned group
 * apart, and search matches both the name and the `(+code)` in the label. A
 * handful of ISO codes carry no calling code (`getCountryCallingCode` throws)
 * and are skipped.
 */
export const buildCountryOptions = (locale: string): CountryOption[] =>
  getCountries()
    .flatMap<CountryOption>((iso) => {
      try {
        const callingCode = getCountryCallingCode(iso);
        const name = regionName(iso, locale);
        return [{ value: iso, name, callingCode, label: `${name} (+${callingCode})` }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, locale));

/** Format the national part as the user types (country code lives in the picker). */
export const formatAsTyped = (iso: CountryCode, input: string): string =>
  new AsYouType(iso).input(input);

/** Canonical E.164 (`+905321234567`), or '' when the input isn't parseable yet. */
export const toE164 = (iso: CountryCode, input: string): string => {
  const parsed = parsePhoneNumberFromString(input, iso);
  return parsed ? parsed.number : '';
};

/**
 * True when `value` is a complete, valid phone number. Empty string is treated
 * as valid — the field is optional; callers gate on non-empty separately.
 */
export const isValidPhone = (value: string): boolean =>
  value === '' || isValidPhoneNumber(value);

/** Split a stored E.164 back into `{ country, nationalNumber }` for display. */
export const describe = (
  e164: string
): { country?: CountryCode; nationalNumber: string } => {
  if (!e164) {
    return { nationalNumber: '' };
  }
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) {
    return { nationalNumber: '' };
  }
  return { country: parsed.country, nationalNumber: parsed.nationalNumber };
};

export { getCountries, getCountryCallingCode };
export type { CountryCode };
