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
  iconTone,
  className,
}: EmptyStateProps): React.ReactElement => {
  // A toned disc means this surface is the failure format the error popup
  // (`Dialog` -> `MessageModal`) uses, so the TYPE SCALE has to follow it too:
  // a 23px brand-blue headline over `body` copy, not the 15px card title and
  // 13px caption an empty list gets. Matching only the disc left a crash screen
  // reading as a quiet empty state.
  const isDialogFormat = Boolean(iconTone);
  const titleVariant = isDialogFormat
    ? 'h1'
    : size === 'sm'
      ? 'body-sm'
      : size === 'lg'
        ? 'h4'
        : 'h5';
  // Half the disc's diameter on a toned (failure) disc, so the mark carries the
  // screen the way the error popup's does. Untoned discs keep Icon's 20px
  // default — which is what they have ALWAYS drawn, since the style file's
  // `svg { width }` rule never won over Icon's own wrapper; enlarging them is a
  // separate visual decision, not a side effect of fixing the error screen.
  const glyphSize = isDialogFormat ? (size === 'sm' ? 24 : size === 'lg' ? 44 : 36) : 20;
  const hasPrimary = Boolean(action && onAction);
  const hasSecondary = Boolean(secondaryAction && onSecondaryAction);

  return (
    <S.EmptyStateWrapper $size={size} className={className}>
      <S.IconCircle $size={size} $tone={iconTone} $spin={icon === 'loader'}>
        <Icon name={icon} size={glyphSize} color={iconTone ? 'text.inverse' : 'brand.primary'} />
      </S.IconCircle>
      <S.Title $size={size}>
        <Text variant={titleVariant} weight="semibold" color={isDialogFormat ? 'brand.primary' : 'text.primary'}>
          {title}
        </Text>
      </S.Title>
      <S.Description $size={size}>
        <Text variant={isDialogFormat ? 'body' : 'body-sm'} color="text.secondary">
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
