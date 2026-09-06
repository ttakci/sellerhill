import type { PriceRange } from '@repo/shared';
import type { TFunction } from 'i18next';

/**
 * One-line read of a listing settings group's repricing strategy — a range (or
 * single value) of whichever margin shape the group's price ranges actually use.
 * Mixed percent+fixed ranges fall back to a count, since a min/max across two
 * different units would misrepresent the group.
 *
 * Both callers feed the same shape: the listing detail passes `PriceRange[]`,
 * the Settings group card `Omit<PriceRange, 'id'>[]` — this only reads the
 * bounds and margin fields common to both. Shared so the two summaries can
 * never drift.
 */
export const summarizeMarginStrategy = (
  ranges: ReadonlyArray<Omit<PriceRange, 'id'>> | undefined,
  fmtCurrency: (value: number) => string,
  t: TFunction
): string | undefined => {
  if (!ranges || ranges.length === 0) {
    return undefined;
  }
  const percents = ranges
    .map((r) => r.profitMarginPercent)
    .filter((v): v is number => typeof v === 'number');
  const fixedAmounts = ranges
    .map((r) => r.fixedProfitAmount)
    .filter((v): v is number => typeof v === 'number');

  if (percents.length > 0 && fixedAmounts.length === 0) {
    const min = Math.min(...percents);
    const max = Math.max(...percents);
    return min === max ? `%${min}` : `%${min}–%${max}`;
  }
  if (fixedAmounts.length > 0 && percents.length === 0) {
    const min = Math.min(...fixedAmounts);
    const max = Math.max(...fixedAmounts);
    return min === max ? fmtCurrency(min) : `${fmtCurrency(min)}–${fmtCurrency(max)}`;
  }
  return t('listings:listings.detail.groupMarginMixed', { count: ranges.length });
};

/**
 * Per-range breakdown backing the Kâr Marjı info tooltip — only meaningful once
 * there is more than one range to distinguish; a single range already says
 * everything `summarizeMarginStrategy` itself does, so it returns `[]` there.
 */
export const buildMarginRangeDetails = (
  ranges: ReadonlyArray<Omit<PriceRange, 'id'>> | undefined,
  fmtCurrency: (value: number) => string,
  t: TFunction,
  dash: string
): string[] => {
  if (!ranges || ranges.length <= 1) {
    return [];
  }
  return ranges.map((range) => {
    const bounds = `${fmtCurrency(range.minPrice)} – ${fmtCurrency(range.maxPrice)}`;
    const value =
      typeof range.profitMarginPercent === 'number'
        ? `%${range.profitMarginPercent}`
        : typeof range.fixedProfitAmount === 'number'
          ? fmtCurrency(range.fixedProfitAmount)
          : dash;
    return t('listings:listings.detail.groupMarginRow', { range: bounds, value });
  });
};
