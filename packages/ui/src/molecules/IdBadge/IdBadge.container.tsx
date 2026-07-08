import { useState } from 'react';

import { IdBadgeComponent } from './IdBadge.component';
import type { IdBadgeProps, StoreType } from './IdBadge.types';

/** Generate the appropriate URL based on store type and ID */
const getStoreUrl = (storeType: StoreType, id: string): string => {
  switch (storeType) {
    case 'amazon':
      return `https://www.amazon.com/dp/${id}`;
    case 'ebay':
      return `https://www.ebay.com/itm/${id}`;
    default:
      return '#';
  }
};

export const IdBadge = ({
  id,
  storeType,
  size = 'sm',
  className,
  onClick,
}: IdBadgeProps) => {
  const url = getStoreUrl(storeType, id);
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
