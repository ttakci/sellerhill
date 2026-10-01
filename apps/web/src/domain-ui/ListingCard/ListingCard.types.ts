import type { IconName } from '@repo/ui';

export type ListingCardOrientation = 'horizontal' | 'vertical';
export type StatTone = 'default' | 'positive' | 'negative' | 'info';

export interface ListingCardStat {
  label: string;
  value: string;
  tone?: StatTone;
  /** Optional glyph before the value (e.g. a filled star beside a rating). */
  icon?: IconName;
  /** Theme color path for `icon`; also fills it (a star reads as a rating only when solid). */
  iconColor?: string;
}

/** Labeled meta row (Brand, ASIN, eBay ID, …). Optional storeType renders value as IdBadge link. */
export interface ListingCardMetaItem {
  label: string;
  value: string;
  storeType?: 'amazon' | 'ebay';
  /** @deprecated Labels carry no icon any more (2026-10-01); accepted and ignored. */
  icon?: IconName;
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
  orientation: ListingCardOrientation;
  onClick?: () => void;
  className?: string;
  /** Show a selection checkbox on the card (for bulk actions in grid view). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  selectionAriaLabel?: string;
  /** @deprecated The card has no "Details →" footer any more — the whole card is the button. Accepted and ignored. */
  showDetailAction?: boolean;
}
