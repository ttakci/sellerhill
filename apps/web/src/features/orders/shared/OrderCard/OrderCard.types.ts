import type { OrderStatus } from '@repo/shared';
import type { BadgeVariant, IconName } from '@repo/ui';

export type OrderCardStatTone = 'default' | 'positive' | 'negative';

export interface OrderCardStatBadge {
  label: string;
  variant?: BadgeVariant;
}

export interface OrderCardStat {
  label: string;
  value: string;
  tone?: OrderCardStatTone;
}

export interface OrderCardMetaItem {
  label: string;
  value: string;
  storeType?: 'amazon' | 'ebay';
  /** Leading row icon — mirrors ListingCard's meta rows (receipt for order #, user for buyer, …). */
  icon?: IconName;
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
  /** Chips shown above the stats row (estimated profit, untracked, …) — a card can carry more than one at once. */
  statsBadges?: OrderCardStatBadge[];
  /** Labeled rows under title (order #, buyer, qty, ASIN, …) */
  meta: OrderCardMetaItem[];
  /** Bottom strip: sale / cost / profit (or similar) */
  stats: OrderCardStat[];
  onClick?: () => void;
  className?: string;
  /** Border/shadow lift on hover — on for the carousel preview, off for the list grid. Defaults to true. */
  hoverEffect?: boolean;
}
