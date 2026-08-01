import { useTheme } from '@emotion/react';
import React from 'react';

import type { AppTheme } from '../../theme/theme.types';

import * as S from './Icon.style';
import { type IconProps } from './Icon.types';
import { iconMap } from './icons';

const sizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
};

/** Resolves a theme dot-path (e.g. 'brand.primary') to its color, else returns the input. */
const resolveThemeColor = (theme: AppTheme, value: string): string => {
  if (value.includes('.')) {
    const [cat, sub] = value.split('.') as [keyof typeof theme.colors, string];
    const category = theme.colors[cat];
    if (category && typeof category === 'object' && sub in category) {
      return (category as Record<string, string>)[sub];
    }
  } else if (value === 'inverse' && theme.colors?.text?.inverse) {
    return theme.colors.text.inverse;
  }
  return value;
};

export const Icon = ({
  name,
  size = 'md',
  color = 'currentColor',
  stroke,
  strokeWidth = 2,
  filled,
  className,
  style,
  ...props
}: IconProps): React.ReactElement => {
  const theme = useTheme() as AppTheme;
  const numericSize = typeof size === 'number' ? size : sizeMap[size];
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found`);
    return <></>;
  }

  const resolvedColor = resolveThemeColor(theme, color);
  const strokeColor = stroke || resolvedColor;
  const fill =
    typeof filled === 'string' ? resolveThemeColor(theme, filled) : filled ? strokeColor : undefined;

  return (
    <S.IconWrapper
      $size={numericSize}
      aria-hidden="true"
      className={className}
      // eslint-disable-next-line design-system/no-inline-styles -- pass-through style prop for consumer overrides
      style={style}
      {...props}
    >
      <IconComponent fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
    </S.IconWrapper>
  );
};
