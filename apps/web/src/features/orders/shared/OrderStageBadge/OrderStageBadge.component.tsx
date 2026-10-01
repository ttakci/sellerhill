import { Badge, Icon, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './OrderStageBadge.style';
import type { OrderStageBadgeViewProps } from './OrderStageBadge.types';

export const OrderStageBadgeComponent: React.FC<OrderStageBadgeViewProps> = ({
  label,
  tooltip,
  variant,
  icon,
  size,
}) => {
  const badge = (
    <Badge variant={variant} size={size}>
      <S.Inner>
        <Icon name={icon} size={size === 'md' ? 16 : 14} />
        {label}
      </S.Inner>
    </Badge>
  );
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
};
