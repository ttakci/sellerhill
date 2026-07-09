import type React from 'react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './Drawer.style';
import type { DrawerComponentProps } from './Drawer.types';

export const DrawerComponent: React.FC<DrawerComponentProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  primaryAction,
  footer,
  size = 'md',
  className,
}) => {
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
                <Text variant="h2" weight="bold">
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
        {primaryAction ? (
          <S.Footer>
            <Button
              variant="primary"
              size="large"
              fullWidth
              onClick={primaryAction.onClick}
              isLoading={primaryAction.isLoading}
              disabled={primaryAction.disabled}
            >
              <Text weight="bold">{primaryAction.label}</Text>
            </Button>
          </S.Footer>
        ) : (
          footer && <S.Footer>{footer}</S.Footer>
        )}
      </S.Panel>
    </>
  );
};

DrawerComponent.displayName = 'DrawerComponent';
