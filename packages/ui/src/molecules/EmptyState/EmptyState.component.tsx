import React from 'react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

import * as S from './EmptyState.style';
import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState = ({
  icon = 'inbox',
  title,
  description,
  action,
  onAction,
  size = 'md',
  className,
}: EmptyStateProps): React.ReactElement => {
  return (
    <S.EmptyStateWrapper $size={size} className={className}>
      <S.IconCircle $size={size}>
        <Icon name={icon} />
      </S.IconCircle>
      <S.Title $size={size}>{title}</S.Title>
      <S.Description $size={size}>{description}</S.Description>
      {action && onAction && (
        <Button variant="primary" onClick={onAction}>
          {action}
        </Button>
      )}
    </S.EmptyStateWrapper>
  );
};

EmptyState.displayName = 'EmptyState';
