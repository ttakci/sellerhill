export type ListingCardOrientation = 'horizontal' | 'vertical';
export type StatTone = 'default' | 'positive' | 'negative' | 'info';

export interface ListingCardStat {
  label: string;
  value: string;
  tone?: StatTone;
}

export interface ListingCardBadge {
  id: string;
  storeType: 'amazon' | 'ebay';
  size?: 'sm' | 'md';
}

export interface ListingCardStatus {
  label: string;
  tone: 'active' | 'neutral';
}

export interface ListingCardProps {
  title: string;
  imageUrl?: string;
  brand?: string;
  primaryBadge?: ListingCardBadge;
  secondaryBadge?: ListingCardBadge;
  stats: ListingCardStat[];
  status: ListingCardStatus;
  soldCount?: number;
  watchCount?: number;
  orientation: ListingCardOrientation;
  onClick?: () => void;
  className?: string;
}
