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
  numeric = false,
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
    $numeric={numeric}
    $color={color}
    className={className}
    // eslint-disable-next-line design-system/no-inline-styles -- pass-through style prop for consumer overrides
    style={style}
  >
    {children}
  </S.TextElement>
);
