import React from 'react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './EmptyState.style';
import type { EmptyStateProps } from './EmptyState.types';

export const EmptyState = ({
  icon = 'inbox',
  title,
  description,
  action,
  onAction,
  isActionLoading = false,
  secondaryAction,
  onSecondaryAction,
  size = 'md',
  className,
}: EmptyStateProps): React.ReactElement => {
  const titleVariant = size === 'sm' ? 'body-sm' : size === 'lg' ? 'h4' : 'h5';
  const hasPrimary = Boolean(action && onAction);
  const hasSecondary = Boolean(secondaryAction && onSecondaryAction);

  return (
    <S.EmptyStateWrapper $size={size} className={className}>
      <S.IconCircle $size={size} $spin={icon === 'loader'}>
        <Icon name={icon} color="brand.primary" />
      </S.IconCircle>
      <S.Title $size={size}>
        <Text variant={titleVariant} weight="semibold" color="text.primary">
          {title}
        </Text>
      </S.Title>
      <S.Description $size={size}>
        <Text variant="body-sm" color="text.secondary">
          {description}
        </Text>
      </S.Description>
      {(hasPrimary || hasSecondary) && (
        <S.Actions>
          {hasPrimary && (
            <Button variant="primary" size="medium" onClick={onAction} isLoading={isActionLoading}>
              <Text variant="body">{action}</Text>
            </Button>
          )}
          {hasSecondary && (
            <Button variant="secondary" size="medium" onClick={onSecondaryAction}>
              <Text variant="body">{secondaryAction}</Text>
            </Button>
          )}
        </S.Actions>
      )}
    </S.EmptyStateWrapper>
  );
};

EmptyState.displayName = 'EmptyState';
