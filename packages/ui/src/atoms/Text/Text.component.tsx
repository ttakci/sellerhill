import React from 'react';

import { S } from './Text.style';
import type { TextProps } from './Text.types';

export const Text = ({
  children,
  as = 'span',
  variant = 'body',
  weight = 'regular',
  align,
  muted = false,
  truncate = false,
}: TextProps): React.ReactElement => {
  return (
    <S.TextElement as={as} $variant={variant} $weight={weight} $align={align} $muted={muted} $truncate={truncate}>
      {children}
    </S.TextElement>
  );
};
