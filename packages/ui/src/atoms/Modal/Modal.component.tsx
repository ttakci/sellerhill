import type React from 'react';

import { Icon } from '../Icon';
import { Text } from '../Text';

import * as S from './Modal.style';
import type { ModalComponentProps } from './Modal.types';

export const ModalComponent: React.FC<ModalComponentProps> = ({
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
              <Text variant="h3" weight="semibold">
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

ModalComponent.displayName = 'ModalComponent';
