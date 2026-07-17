/**
 * Format utilities for currency, numbers, and dates.
 * Platform-agnostic — works with any locale.
 */

/**
 * Format a number as currency.
 */
export const formatCurrency = (
  value: number,
  locale: string = 'en-US',
  currency: string = 'USD',
  minimumFractionDigits: number = 0,
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
  }).format(value);

/**
 * Format a number in compact notation (e.g., 1.2K, 3.4M).
 */
export const formatCompactNumber = (
  value: number,
  locale: string = 'en-US',
  maximumFractionDigits: number = 1,
): string =>
  new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits,
  }).format(value);

/**
 * Format a date string into a localized date(time).
 */
export const formatDate = (
  dateString: string,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions,
): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...options,
  }).format(new Date(dateString));

/**
 * Get locale and currency based on language code.
 * Accepts bare codes (`tr`, `en`) or BCP-47 tags (`tr-TR`, `en-US`).
 */
export const getLocaleConfig = (language: string) => {
  const code = (language || 'en').toLowerCase().split('-')[0];
  const isTR = code === 'tr';
  return {
    locale: isTR ? 'tr-TR' : 'en-US',
    currency: isTR ? 'TRY' : 'USD',
  };
};
