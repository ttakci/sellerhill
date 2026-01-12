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
  const numericSize = typeof size === 'number' ? size : sizeMap[size];
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return <></>;
  }

  return (
    <S.IconWrapper
      $size={numericSize}
      as={IconComponent}
      stroke={stroke || color}
      strokeWidth={strokeWidth}
      aria-hidden="true"
    />
  );
};
