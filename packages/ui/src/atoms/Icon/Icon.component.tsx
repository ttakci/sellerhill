import { useTheme } from '@emotion/react';
import React from 'react';

import * as S from './Icon.style';
import { type IconProps } from './Icon.types';
import { iconMap } from './icons';

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
};

export const Icon = ({
  name,
  size = 'md',
  color = 'currentColor',
  stroke,
  strokeWidth = 2,
}: IconProps): React.ReactElement => {
  const theme = useTheme() as any;
  const numericSize = typeof size === 'number' ? size : sizeMap[size];
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return <></>;
  }

  // Resolve theme color if dot notation is used (e.g., 'brand.primary')
  let resolvedColor = color;
  if (color && color.includes('.')) {
    const [cat, sub] = color.split('.');
    if (theme.colors && theme.colors[cat] && theme.colors[cat][sub]) {
      resolvedColor = theme.colors[cat][sub];
    }
  } else if (color === 'inverse' && theme.colors?.text?.inverse) {
    resolvedColor = theme.colors.text.inverse;
  }

  return (
    <S.IconWrapper $size={numericSize} aria-hidden="true">
      <IconComponent
        stroke={stroke || resolvedColor}
        strokeWidth={strokeWidth}
      />
    </S.IconWrapper>
  );
};
