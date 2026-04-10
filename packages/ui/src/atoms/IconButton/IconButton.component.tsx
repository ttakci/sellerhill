import React from 'react';
import * as S from './IconButton.style';
import type { IconButtonProps } from './IconButton.types';

export const IconButton = ({
  variant = 'ghost',
  children,
  ...rest
}: IconButtonProps): React.ReactElement => {
  return (
    <S.IconButtonContainer $variant={variant} {...rest}>
      {children}
    </S.IconButtonContainer>
  );
};

IconButton.displayName = 'IconButton';
