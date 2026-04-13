import React, { useEffect } from 'react';

import { Icon } from '../Icon';
import { Text } from '../Text';

import * as S from './Modal.style';
import type { ModalProps } from './Modal.types';

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
  showCloseButton = true,
  showDivider = true,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  if (!isOpen) {return null;}

  return (
    <S.Overlay $isOpen={isOpen} onClick={onClose}>
      <S.ModalContainer
        $size={size}
        className={className}
        onClick={(e) => e.stopPropagation()}
      >
        {title || showCloseButton ? (
          <S.Header $showDivider={showDivider}>
            {title && (
              <Text variant="h3" weight="bold">
                {title}
              </Text>
            )}
            {showCloseButton && (
              <S.CloseButton onClick={onClose}>
                <Icon name="x" size={24} />
              </S.CloseButton>
            )}
          </S.Header>
        ) : null}
        <S.Body $noPadding={!title && !showCloseButton}>{children}</S.Body>
        {footer && <S.Footer $showDivider={showDivider}>{footer}</S.Footer>}
      </S.ModalContainer>
    </S.Overlay>
  );
};
