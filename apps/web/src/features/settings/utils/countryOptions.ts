import { COUNTRY_CODES } from '@repo/shared';
import type { ModernSelectOption } from '@repo/ui';

/**
 * Country picker options, localized by the browser rather than by i18n files.
 *
 * `Intl.DisplayNames` is what keeps 249 countries × 2 locales out of the
 * translation resources — the browser already ships those names, and a hand
 * maintained table would go stale the first time a country is renamed. Same
 * approach the phone-number picker already takes (`PhoneInput`'s `regionName`).
 *
 * The ISO code is kept in the label (`United States (US)`) for two reasons: it
 * is what actually gets stored and sent to eBay, and `Select`'s search matches
 * the label, so a seller who knows the code can type it instead of the name.
 *
 * Sorted by the LOCALIZED name — the alphabetical order of the English names
 * is not the order a Turkish seller scans.
 */
export function getCountryOptions(locale: string): ModernSelectOption[] {
  let display: Intl.DisplayNames | undefined;
  try {
    display = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    // Unsupported locale tag — fall back to the bare codes rather than to an
    // empty picker, which would block the whole address step.
    display = undefined;
  }

  return COUNTRY_CODES.map((code) => {
    const name = display?.of(code) ?? code;
    return { value: code, label: name === code ? code : `${name} (${code})`, name };
  })
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ value, label }) => ({ value, label }));
}
