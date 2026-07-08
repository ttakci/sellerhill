import type React from 'react';

export type StoreType = 'amazon' | 'ebay';

export interface IdBadgeProps {
  /** The ID to display (ASIN for Amazon, listing ID for eBay) */
  id: string;
  /** Store type - determines the logo and URL pattern */
  storeType: StoreType;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional CSS class name */
  className?: string;
  /** Optional click handler */
  onClick?: (e: React.MouseEvent) => void;
}

export interface IdBadgeComponentProps {
  url: string;
  id: string;
  size?: 'sm' | 'md';
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}
