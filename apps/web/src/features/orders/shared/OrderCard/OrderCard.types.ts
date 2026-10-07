import type { OrderStage } from '@repo/shared';
import type { BadgeVariant } from '@repo/ui';
import type React from 'react';

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
  /** With `storeType`: open this URL instead of the item page (an eBay order, a cancellation request). */
  href?: string;
}

/**
 * Product-first order surface: title, stage, a few labelled facts, and the
 * money row. Callers map OrderDto → these props (formatters stay outside).
 */
export interface OrderCardProps {
  /** Product title (primary heading) */
  productTitle: string;
  imageUrl?: string;
  ebayOrderId: string;
  /** The seller-facing stage — one badge, same vocabulary as the list and the detail page. */
  stage?: OrderStage;
  /** A record of another kind (a return) puts its own status badge here instead of a stage. */
  leadingBadge?: React.ReactNode;
  /** False for an order SellerHill does not follow: only its chip shows, never a stage. */
  showStage?: boolean;
  /** Drives the tracking-held alarm colour (amber → red after 12 h). */
  shippedDetectedAt?: string | null;
  /** Chips shown above the stats row (estimated profit, untracked, …) — a card can carry more than one at once. */
  statsBadges?: OrderCardStatBadge[];
  /** Labeled rows under title (order #, buyer, qty, ASIN, …) */
  meta: OrderCardMetaItem[];
  /** Chip on its own line at the top-left of the figures row (the estimated-profit marker). */
  footerBadge?: OrderCardStatBadge;
  /** Hint at the end of the figures row that the whole card opens the order. */
  detailLabel?: string;
  /** Bottom strip: sale / cost / profit (or similar) */
  stats: OrderCardStat[];
  onClick?: () => void;
  className?: string;
  /** Border/shadow lift on hover — on for the carousel preview, off for the list grid. Defaults to true. */
  hoverEffect?: boolean;
}
