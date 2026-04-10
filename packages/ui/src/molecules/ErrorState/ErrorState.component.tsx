import React from 'react';
import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import * as S from './ErrorState.style';
import type { ErrorStateProps } from './ErrorState.types';

export const ErrorState = ({
  title,
  description,
  primaryAction,
  secondaryAction,
  onPrimaryAction,
  onSecondaryAction,
  className,
}: ErrorStateProps): React.ReactElement => {
  const hasActions = (primaryAction && onPrimaryAction) || (secondaryAction && onSecondaryAction);

  return (
    <S.ErrorStateWrapper className={className}>
      <S.ErrorIconCircle>
        <Icon name="alert-circle" />
      </S.ErrorIconCircle>
      <S.Title>{title}</S.Title>
      <S.Description>{description}</S.Description>
      {hasActions && (
        <S.ActionsRow>
          {secondaryAction && onSecondaryAction && (
            <Button variant="secondary" onClick={onSecondaryAction}>
              {secondaryAction}
            </Button>
          )}
          {primaryAction && onPrimaryAction && (
            <Button variant="primary" onClick={onPrimaryAction}>
              {primaryAction}
            </Button>
          )}
        </S.ActionsRow>
      )}
    </S.ErrorStateWrapper>
  );
};

ErrorState.displayName = 'ErrorState';
