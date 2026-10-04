import React from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './QuickActionCard.style';
import type { QuickActionCardProps } from './QuickActionCard.types';

/**
 * A single-action call-to-action card: title + optional subtitle on the left,
 * a circular arrow on the right. The whole card is clickable.
 */
export const QuickActionCard = ({
  title,
  subtitle,
  onClick,
  variant = 'default',
  icon,
  className,
}: QuickActionCardProps): React.ReactElement => {
  const isSolid = variant === 'solid';
  const isBrand = variant === 'brand' || isSolid;
  const accentColor = isSolid ? 'text.inverse' : 'brand.primary';
  return (
    <S.Container $variant={variant} className={className} onClick={onClick} role="button" tabIndex={0}>
      {icon && (
        <S.IconTile $variant={variant}>
          <Icon name={icon} size={22} color={accentColor} />
        </S.IconTile>
      )}
      <S.Content>
        <Text variant="h3" weight={isBrand ? 'bold' : 'semibold'} color={isBrand ? accentColor : 'text.primary'}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="body-sm" color={isSolid ? 'text.inverse' : 'text.secondary'}>
            {subtitle}
          </Text>
        )}
      </S.Content>
      <S.ArrowCircle $variant={variant}>
        <Icon name="arrow-right" size={18} color={isBrand ? accentColor : 'text.secondary'} />
      </S.ArrowCircle>
    </S.Container>
  );
};

QuickActionCard.displayName = 'QuickActionCard';
