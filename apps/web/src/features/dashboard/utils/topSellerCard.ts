/**
 * A top seller's figures for the listing card: what the listing did in the
 * selected range (revenue with its change, units, orders, confirmed net
 * profit). Money is two decimals in the listing's own currency — never the UI
 * language's; `locale` only sets separators.
 */

import type { TopListingDto } from '@repo/shared';
import { formatCurrency, type SparklineTone } from '@repo/ui';
import type { TFunction } from 'i18next';

import type { ListingCardStat, StatTone } from '@/domain-ui';

/** The trend line's colour follows the revenue change: up green, down red, flat or no comparison grey. */
export const trendTone = (change: number | null): SparklineTone => {
  if (change === null || change === undefined || change === 0) {
    return 'neutral';
  }
  return change > 0 ? 'positive' : 'negative';
};

/** The change caption's colour: up positive, down negative, flat or no comparison muted (undefined). */
export const changeTone = (change: number | null): StatTone | undefined => {
  if (change === null || change === undefined || change === 0) {
    return undefined;
  }
  return change > 0 ? 'positive' : 'negative';
};

/** A profit figure's colour: gain positive, loss negative, exactly zero muted (undefined). */
export const profitTone = (value: number): StatTone | undefined => {
  if (value === 0) {
    return undefined;
  }
  return value > 0 ? 'positive' : 'negative';
};

/** "+12.5%" / "−3.1%", or undefined when there is no comparable period. */
export const formatSignedPercent = (change: number | null, locale: string): string | undefined => {
  if (change === null || change === undefined) {
    return undefined;
  }
  const abs = Math.abs(Math.round(change * 10) / 10);
  return `${change >= 0 ? '+' : '−'}${new Intl.NumberFormat(locale).format(abs)}%`;
};

/** "+$210.25" / "−$5.00" / "$0.00" in the listing's currency. */
export const formatSignedMoney = (value: number, locale: string, currency: string): string =>
  `${value === 0 ? '' : value > 0 ? '+' : '−'}${formatCurrency(Math.abs(value), locale, currency, 2)}`;

export const toTopSellerStats = (item: TopListingDto, t: TFunction, locale: string): ListingCardStat[] => {
  const currency = item.listing.currency || 'USD';
  const count = new Intl.NumberFormat(locale);
  const { sales, units, orders, netProfit, profitProvisional } = item.metrics;

  return [
    {
      label: t('dashboard.topSellers.stats.sales'),
      value: formatCurrency(sales, locale, currency, 2),
      secondary: formatSignedPercent(item.changes.sales, locale),
      secondaryTone: changeTone(item.changes.sales),
    },
    { label: t('dashboard.topSellers.stats.units'), value: count.format(units) },
    { label: t('dashboard.topSellers.stats.orders'), value: count.format(orders) },
    {
      label: t('dashboard.topSellers.stats.netProfit'),
      value: formatSignedMoney(netProfit, locale, currency),
      tone: profitTone(netProfit),
      // The value is the CONFIRMED profit; the provisional part is shown apart, muted.
      secondary:
        profitProvisional !== 0
          ? t('dashboard.topSellers.estimatedAmount', {
              amount: formatSignedMoney(profitProvisional, locale, currency),
            })
          : undefined,
    },
  ];
};
