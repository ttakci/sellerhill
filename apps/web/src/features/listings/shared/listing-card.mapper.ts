import { ListingStatus, type ListingDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import type { ListingCardProps } from '@/domain-ui';

/**
 * Single source of truth: ListingDto → ListingCard props (minus orientation / selection).
 * Used by overview carousel and listings-all grid so both pages render the same card.
 * Status pill only for non-active (e.g. draft list).
 */
export const toListingCardProps = (
  listing: ListingDto,
  t: TFunction
): Omit<ListingCardProps, 'orientation' | 'selectable' | 'selected' | 'onSelectedChange' | 'selectionAriaLabel'> => {
  const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
  const profit = listing.estimatedProfit ?? 0;
  const roi = listing.roi ?? 0;

  const meta: NonNullable<ListingCardProps['meta']> = [];

  if (listing.brand) {
    meta.push({
      label: t('listings.table.brand'),
      value: listing.brand,
      icon: 'building-2',
    });
  }

  meta.push({
    label: t('listings.table.asin'),
    value: listing.asin,
    storeType: 'amazon',
    icon: 'barcode',
  });

  if (listing.ebayListingId) {
    meta.push({
      label: t('listings.table.ebayId'),
      value: listing.ebayListingId,
      storeType: 'ebay',
      icon: 'tag',
    });
  }

  if (typeof listing.soldCount === 'number' && listing.soldCount > 0) {
    meta.push({
      label: t('listings.table.sold'),
      value: String(listing.soldCount),
      icon: 'shopping-cart',
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
        label: t('listings.table.estimatedProfit'),
        value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
        tone: profit >= 0 ? 'positive' : 'negative',
      },
      {
        label: t('listings.table.roi'),
        value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
        tone: roi >= 0 ? 'positive' : 'negative',
      },
      {
        label: t('listings.table.stock'),
        value: String(listing.quantity),
        tone: listing.quantity === 0 ? 'negative' : 'default',
      },
    ],
  };
};
