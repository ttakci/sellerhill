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
  onBack,
  backAriaLabel,
  children,
  primaryAction,
  footer,
  size = 'md',
  className,
}) => {
  if (!isOpen) {return null;}

  const showHeader = title || subtitle || onBack;

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
        {showHeader && (
          <S.Header>
            {onBack && (
              <S.BackButton onClick={onBack} aria-label={backAriaLabel ?? 'Back'}>
                <Icon name="arrow-left" size={24} />
              </S.BackButton>
            )}
            <S.HeaderText>
              {title && (
                <Text variant="h3" weight="semibold" color="text.primary">
                  {title}
                </Text>
              )}
              {subtitle && (
                <Text variant="body-sm" color="text.secondary">
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
              size="medium"
              fullWidth
              onClick={primaryAction.onClick}
              isLoading={primaryAction.isLoading}
              disabled={primaryAction.disabled}
            >
              <Text variant="body" weight="semibold">
                {primaryAction.label}
              </Text>
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
