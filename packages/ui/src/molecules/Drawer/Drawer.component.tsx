import React, { useEffect } from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './Drawer.style';
import type { DrawerProps } from './Drawer.types';

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
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

  useEffect(() => {
    if (!isOpen) {return;}
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) {return null;}

  return (
    <>
      <S.Overlay $isOpen={isOpen} onClick={onClose} />
      <S.Panel
        $size={size}
        $isOpen={isOpen}
        className={className}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle) && (
          <S.Header>
            <S.HeaderText>
              {title && (
                <Text variant="h3" weight="bold">
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text variant="caption" color="text.secondary">
                  {subtitle}
                </Text>
              )}
            </S.HeaderText>
            <S.CloseButton onClick={onClose} aria-label="Close drawer">
              <Icon name="x" size={24} />
            </S.CloseButton>
          </S.Header>
        )}
        <S.Body>{children}</S.Body>
        {footer && <S.Footer>{footer}</S.Footer>}
      </S.Panel>
    </>
  );
};
