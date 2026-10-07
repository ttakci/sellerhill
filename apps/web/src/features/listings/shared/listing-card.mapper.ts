import { formatSourceStock, ListingStatus, type ListingDto } from '@repo/shared';
import { formatCurrency, formatDate } from '@repo/ui';
import type { TFunction } from 'i18next';

import type { ListingCardProps } from '@/domain-ui';

/**
 * Single source of truth: ListingDto → ListingCard props (minus orientation / selection).
 * Used by overview carousel and listings-all grid so both pages render the same card.
 * Status pill only for non-active (e.g. draft list).
 *
 * `locale` controls only separators/ordering — currency always comes from the
 * listing's own resolved `currency` (its eBay store's marketplace), never the
 * UI language. See CLAUDE.md "Currency is resolved from the connected eBay
 * store's marketplace".
 */
export const toListingCardProps = (
  listing: ListingDto,
  t: TFunction,
  locale: string
): Omit<ListingCardProps, 'orientation' | 'selectable' | 'selected' | 'onSelectedChange' | 'selectionAriaLabel'> => {
  const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
  const profit = listing.estimatedProfit ?? 0;

  const meta: NonNullable<ListingCardProps['meta']> = [];

  if (listing.brand) {
    meta.push({
      label: t('listings.table.brand'),
      value: listing.brand,
    });
  }

  meta.push({
    label: t('listings.table.asin'),
    value: listing.asin,
    storeType: 'amazon',
  });

  if (listing.ebayListingId) {
    meta.push({
      label: t('listings.table.ebayId'),
      value: listing.ebayListingId,
      storeType: 'ebay',
    });
  }

  // Always shown: a listing that has not sold yet reads 0, not a missing row.
  meta.push({
    label: t('listings.table.sold'),
    value: String(listing.soldCount ?? 0),
  });

  // Amazon's own stock beside the eBay quantity; `20+` stays a lower bound.
  const amazonStock =
    listing.sourceStock === null || listing.sourceStock === undefined
      ? '—'
      : formatSourceStock(listing.sourceStock, listing.sourceStockStatus);
  meta.push({
    label: t('listings.table.stockEbayAmazon'),
    value: `${listing.quantity} / ${amazonStock}`,
  });

  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  meta.push({
    label: t('listings.table.createdAt'),
    value: formatDate(listing.createdAt, locale, dateOptions),
  });
  // The last time the Amazon source was read — a check counts even when nothing changed.
  if (listing.lastSyncedAt) {
    meta.push({
      label: t('listings.table.lastSynced'),
      value: formatDate(listing.lastSyncedAt, locale, { ...dateOptions, hour: '2-digit', minute: '2-digit' }),
    });
  }

  const statusLabel =
    listing.status === ListingStatus.DRAFT
      ? t('listings.status.draft')
      : listing.status === ListingStatus.INACTIVE
        ? t('listings.status.inactive')
        : undefined;

  return {
    title,
    imageUrl: listing.imageUrls?.[0],
    meta,
    status: statusLabel
      ? {
          label: statusLabel,
          tone: 'neutral' as const,
        }
      : undefined,
    stats: [
      {
        label: t('listings.table.price'),
        value: formatCurrency(listing.price, locale, listing.currency || 'USD', 2),
      },
      {
        label: t('listings.table.purchasePrice'),
        value: formatCurrency(listing.purchasePrice ?? 0, locale, listing.currency || 'USD', 2),
      },
      {
        label: t('listings.table.estimatedProfit'),
        value: `${profit >= 0 ? '+' : ''}${formatCurrency(profit, locale, listing.currency || 'USD', 2)}`,
        tone: profit >= 0 ? 'positive' : 'negative',
      },
    ],
    detailLabel: t('translation:common.details'),
  };
};
