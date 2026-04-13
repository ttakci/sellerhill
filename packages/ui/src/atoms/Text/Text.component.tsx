import React from 'react';

import { S } from './Text.style';
import type { TextProps } from './Text.types';

export const Text = ({
  children,
  variant = 'body',
  weight = 'regular',
  align,
  muted = false,
  truncate = false,
  color,
  className,
  style,
}: TextProps): React.ReactElement => (
  <S.TextElement
    $variant={variant}
    $weight={weight}
    $align={align}
    $muted={muted}
    $truncate={truncate}
    $color={color}
    className={className}
    style={style}
  >
    {children}
  </S.TextElement>
);
