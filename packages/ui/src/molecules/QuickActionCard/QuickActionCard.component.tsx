import React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './QuickActionCard.style';
import type { QuickActionCardProps } from './QuickActionCard.types';

export const QuickActionCard = ({
  icon,
  title,
  subtitle,
  onClick,
  variant = 'default',
  className,
}: QuickActionCardProps): React.ReactElement => {
  return (
    <S.QuickActionCardContainer $variant={variant} className={className} onClick={onClick} role="button" tabIndex={0}>
      <S.IconArea $variant={variant}>
        <Icon name={icon} size={20} />
      </S.IconArea>
      <S.Title>{title}</S.Title>
      {subtitle && <S.Subtitle>{subtitle}</S.Subtitle>}
    </S.QuickActionCardContainer>
  );
};

QuickActionCard.displayName = 'QuickActionCard';
