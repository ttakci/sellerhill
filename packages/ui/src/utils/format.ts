/**
 * Format utilities for currency, numbers, and dates.
 * Platform-agnostic — works with any locale.
 *
 * Every formatter below goes through a process-wide instance cache. Constructing
 * an `Intl.NumberFormat` / `Intl.DateTimeFormat` is one to two orders of
 * magnitude more expensive than calling `.format()` on an existing one, and
 * these helpers are called per table cell, per card and per chart tick. The
 * worst case is exactly a language switch: `languageChanged` re-renders every
 * consumer at once, so an uncached build reconstructs every formatter in the app
 * in a single frame.
 *
 * The key set is bounded by (locale × options), so the cache cannot grow
 * unbounded — the app ships two locales and a handful of option shapes.
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

const getNumberFormat = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
};

const getDateFormat = (locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, formatter);
  }
  return formatter;
};

/**
 * Format a number as currency.
 */
export const formatCurrency = (
  value: number,
  locale: string = 'en-US',
  currency: string = 'USD',
  minimumFractionDigits: number = 0,
): string =>
  getNumberFormat(locale, {
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
  getNumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits,
  }).format(value);

/**
 * Format a micro-currency amount (1/1,000,000 units — the platform's BIGINT
 * cost convention) as a readable currency string. Callers must handle null
 * (unknown cost) themselves — unknown is never rendered as 0.
 */
export const formatMicroCurrency = (
  micros: number,
  locale: string = 'en-US',
  currency: string = 'USD',
): string => formatCurrency(micros / 1_000_000, locale, currency, 2);

/**
 * Format a date string into a localized date(time).
 */
export const formatDate = (
  dateString: string,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions,
): string =>
  getDateFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...options,
  }).format(new Date(dateString));

/**
 * The two resolved configs, returned by identity. Several containers call
 * `getLocaleConfig(i18n.language)` outside a `useMemo` and feed the result into
 * one — a fresh object per render invalidated those memos on every render, so
 * column definitions and derived rows were rebuilt continuously.
 */
const LOCALE_CONFIGS = {
  en: { locale: 'en-US' },
  tr: { locale: 'tr-TR' },
} as const;

/**
 * Get the number/date locale for a UI language code. Accepts bare codes
 * (`tr`, `en`) or BCP-47 tags (`tr-TR`, `en-US`).
 *
 * Deliberately does NOT resolve a currency: the UI language controls only
 * separators/ordering, never which currency money renders in. Currency is
 * domain data — the seller's connected eBay store marketplace
 * (`EBAY_MARKETPLACE_CONFIG`), a listing/order's own `currency` field, or a
 * billing plan's `currency` — and must be threaded through explicitly by the
 * caller. An earlier version returned `{ locale, currency }` keyed off the
 * language, which made every Turkish-language session render eBay-USD sale
 * amounts as TRY even though the seller's store was still eBay US.
 */
export const getLocaleConfig = (language: string): { locale: string } => {
  const code = (language || 'en').toLowerCase().split('-')[0];
  return code === 'tr' ? LOCALE_CONFIGS.tr : LOCALE_CONFIGS.en;
};
