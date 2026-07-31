import { useState } from 'react';

import { useMarketplaceContext } from '../../context';

import { IdBadgeComponent } from './IdBadge.component';
import type { IdBadgeProps } from './IdBadge.types';

export const IdBadge = ({
  id,
  storeType,
  size = 'sm',
  className,
  onClick,
}: IdBadgeProps) => {
  // URL building is injected by the app: eBay item links are environment-scoped
  // (a sandbox item id does not resolve on ebay.com), and the design system
  // must not know about deployment environments.
  const { buildEbayItemUrl, buildAmazonProductUrl } = useMarketplaceContext();
  const url = storeType === 'ebay' ? buildEbayItemUrl(id) : buildAmazonProductUrl(id);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <IdBadgeComponent
      url={url}
      id={id}
      size={size}
      className={className}
      onClick={onClick}
      isHovered={isHovered}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );
};

IdBadge.displayName = 'IdBadge';
