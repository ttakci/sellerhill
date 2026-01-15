import React from 'react';

import { S } from './Button.style';
import type { ButtonProps } from './Button.types';

export const Button = ({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  disabled = false,
  type = 'button',
  className,
  style,
}: ButtonProps): React.ReactElement => {
  return (
    <S.ButtonContainer
      onClick={onClick}
      type={type}
      $variant={variant}
      $size={size}
      $fullWidth={fullWidth}
      $isLoading={isLoading}
      disabled={disabled || isLoading}
      className={className}
      style={style}
    >
      {children}
    </S.ButtonContainer>
  );
};
