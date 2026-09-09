import type React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './IdBadge.style';
import type { IdBadgeComponentProps } from './IdBadge.types';

export const IdBadgeComponent = ({
  url,
  id,
  size = 'sm',
  className,
  onClick,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  plain = false,
}: IdBadgeComponentProps): React.ReactElement => {
  return (
    <S.BadgeContainer
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      $size={size}
      $plain={plain}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      $isHovered={isHovered}
    >
      <S.IdText $size={size} $isHovered={isHovered} $plain={plain}>
        {id}
      </S.IdText>
      <S.ExternalIcon $size={size} $isHovered={isHovered}>
        <Icon name="open-in-new" />
      </S.ExternalIcon>
    </S.BadgeContainer>
  );
};

IdBadgeComponent.displayName = 'IdBadgeComponent';
