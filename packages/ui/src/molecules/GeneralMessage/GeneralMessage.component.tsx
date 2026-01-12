import React from 'react';

import { Button } from '../../atoms/Button/Button.component';

import * as S from './GeneralMessage.style';
import type { GeneralMessageProps } from './GeneralMessage.types';

const defaultIcons = {
  success: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export const GeneralMessage: React.FC<GeneralMessageProps> = ({
  type,
  header,
  description,
  icon,
  primaryButton,
  secondaryButton,
  onClose,
  isOpen,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  return (
    <S.Overlay onClick={handleOverlayClick}>
      <S.Container type={type}>
        <S.Header>
          <S.IconWrapper type={type}>{icon || defaultIcons[type]}</S.IconWrapper>
          <S.Content>
            {header && <S.Title>{header}</S.Title>}
            <S.Description>{description}</S.Description>
          </S.Content>
        </S.Header>

        {(primaryButton || secondaryButton) && (
          <S.ButtonGroup>
            {secondaryButton && (
              <Button variant="secondary" onClick={secondaryButton.onClick}>
                {secondaryButton.label}
              </Button>
            )}
            {primaryButton && (
              <Button variant={primaryButton.variant || 'primary'} onClick={primaryButton.onClick}>
                {primaryButton.label}
              </Button>
            )}
          </S.ButtonGroup>
        )}
      </S.Container>
    </S.Overlay>
  );
};
