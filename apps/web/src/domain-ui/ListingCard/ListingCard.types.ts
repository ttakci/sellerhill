export type ListingCardOrientation = 'horizontal' | 'vertical';
export type StatTone = 'default' | 'positive' | 'negative' | 'info';

export interface ListingCardStat {
  label: string;
  value: string;
  tone?: StatTone;
}

/** Labeled meta row (Brand, ASIN, eBay ID, …). Optional storeType renders value as IdBadge link. */
export interface ListingCardMetaItem {
  label: string;
  value: string;
  storeType?: 'amazon' | 'ebay';
}

/** @deprecated Prefer meta[] — kept for callers not yet migrated. */
export interface ListingCardBadge {
  id: string;
  storeType: 'amazon' | 'ebay';
  size?: 'sm' | 'md';
  label?: string;
}

export interface ListingCardStatus {
  label: string;
  tone: 'active' | 'neutral';
}

export interface ListingCardProps {
  title: string;
  imageUrl?: string;
  /**
   * Labeled fields under the title (Brand, ASIN, eBay ID).
   * Labels are muted; values are emphasized.
   */
  meta?: ListingCardMetaItem[];
  /** @deprecated Use meta instead */
  brand?: string;
  /** @deprecated Use meta instead */
  primaryBadge?: ListingCardBadge;
  /** @deprecated Use meta instead */
  secondaryBadge?: ListingCardBadge;
  stats: ListingCardStat[];
  /** Optional status pill — omit when the list only shows one status (e.g. active). */
  status?: ListingCardStatus;
  soldCount?: number;
  watchCount?: number;
  orientation: ListingCardOrientation;
  onClick?: () => void;
  className?: string;
  /** Show a selection checkbox on the card (for bulk actions in grid view). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  selectionAriaLabel?: string;
}
