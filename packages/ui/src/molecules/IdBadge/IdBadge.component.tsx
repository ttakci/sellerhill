import React, { useState } from 'react';

import { Icon } from '../../atoms/Icon';
import * as S from './IdBadge.style';
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
}: IdBadgeProps): React.ReactElement => {
  const url = getStoreUrl(storeType, id);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <S.BadgeContainer
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      $size={size}
      className={className}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      $isHovered={isHovered}
    >
      <S.IdText $size={size} $isHovered={isHovered}>
        {id}
      </S.IdText>
      <S.ExternalIcon $size={size} $isHovered={isHovered}>
        <Icon name="open-in-new" />
      </S.ExternalIcon>
    </S.BadgeContainer>
  );
};

IdBadge.displayName = 'IdBadge';
