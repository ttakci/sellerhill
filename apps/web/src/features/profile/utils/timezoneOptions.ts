import type { SupportedValuesOf, TimezoneOption } from './timezoneOptions.types';

/** IANA zones from the browser (same approach as countryOptions' Intl.DisplayNames — no bundled list). */
export function getTimezoneOptions(current?: string): TimezoneOption[] {
  const supportedValuesOf = (Intl as { supportedValuesOf?: SupportedValuesOf }).supportedValuesOf;
  const supported = typeof supportedValuesOf === 'function' ? supportedValuesOf('timeZone') : [];
  const values = new Set<string>(supported);
  values.add('UTC');
  if (current) {
    values.add(current);
  }
  return [...values].sort().map((value) => ({ value, label: value.replace(/_/g, ' ') }));
}
