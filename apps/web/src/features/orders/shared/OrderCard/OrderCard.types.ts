import type { OrderStatus } from '@repo/shared';
import type { BadgeVariant } from '@repo/ui';

export type OrderCardStatTone = 'default' | 'positive' | 'negative';

export interface OrderCardStatBadge {
  label: string;
  variant?: BadgeVariant;
}

export interface OrderCardStat {
  label: string;
  value: string;
  tone?: OrderCardStatTone;
  /** Optional small badge rendered under the stat value (e.g. "Estimated"). */
  badge?: OrderCardStatBadge;
}

export interface OrderCardMetaItem {
  label: string;
  value: string;
  storeType?: 'amazon' | 'ebay';
}

/**
 * ListingCard-parity order surface: product-first, dense meta + 3 stats.
 * Callers map OrderDto → these props (formatters stay outside the card).
 */
export interface OrderCardProps {
  /** Product title (primary heading) */
  productTitle: string;
  imageUrl?: string;
  ebayOrderId: string;
  status: OrderStatus;
  statusLabel: string;
  /** Labeled rows under title (order #, buyer, qty, ASIN, …) */
  meta: OrderCardMetaItem[];
  /** Bottom strip: sale / cost / profit (or similar) */
  stats: OrderCardStat[];
  onClick?: () => void;
  className?: string;
}
