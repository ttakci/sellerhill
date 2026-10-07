import { Badge, Icon, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './ReturnBucketBadge.style';
import type { ReturnBucketBadgeViewProps } from './ReturnBucketBadge.types';

export const ReturnBucketBadgeComponent: React.FC<ReturnBucketBadgeViewProps> = ({
  label,
  tooltip,
  variant,
  icon,
  size,
}) => {
  const badge = (
    <Badge variant={variant} size={size} solid>
      <S.Inner>
        <Icon name={icon} size={size === 'md' ? 16 : 12} />
        {label}
      </S.Inner>
    </Badge>
  );
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
};
