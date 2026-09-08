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
  /**
   * Render the id in the surrounding body-text style — body font, `body-sm`
   * size, `text.primary` ink — instead of the default muted monospace chip.
   * For detail-page fact lists where the id sits among plain `<Text>` rows and
   * the mono chip reads as a different kind of value. The external-link icon
   * and the hover-to-brand affordance are kept.
   */
  plain?: boolean;
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
  plain?: boolean;
}
