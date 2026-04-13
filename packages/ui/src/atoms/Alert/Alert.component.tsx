import React from 'react';

import { Icon } from '../Icon';
import { Text } from '../Text';

import * as S from './Alert.style';
import type { AlertProps } from './Alert.types';

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  icon,
  onClose,
  className,
}) => {
  const defaultIcon = {
    success: 'check-circle' as const,
    warning: 'alert-triangle' as const,
    error: 'alert-circle' as const,
    info: 'info' as const,
  }[variant];

  return (
    <S.AlertContainer $variant={variant} className={className}>
      <S.IconSection>
        <Icon name={icon || defaultIcon} size={20} />
      </S.IconSection>
      <S.ContentSection>
        {title && (
          <Text weight="bold" color="inherit" variant="caption">
            {title}
          </Text>
        )}
        <Text color="inherit" variant="caption">
          {children}
        </Text>
      </S.ContentSection>
      {onClose && (
        <S.CloseButton onClick={onClose}>
          <Icon name="x" size={16} />
        </S.CloseButton>
      )}
    </S.AlertContainer>
  );
};
