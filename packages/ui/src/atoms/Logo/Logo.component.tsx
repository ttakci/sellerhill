import React from 'react';

import logoSvg from '../../assets/logo.svg';
import { Text } from '../Text';

import * as S from './Logo.style';

export interface LogoProps {
  /** Logo height in pixels. Width is calculated automatically to preserve aspect ratio. */
  height?: number;
  /** @deprecated Use `height` instead. Maps to height for backward compat. */
  size?: number;
  className?: string;
  /** Layout variant: 'default' renders the horizontal logo, 'stacked' renders logo mark + stacked text */
  layout?: 'default' | 'stacked';
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  height,
  size,
  className,
  layout = 'default',
  onClick,
}) => {
  if (layout === 'stacked') {
    const markHeight = height ?? size ?? 32;
    return (
      <S.StackedWrapper onClick={onClick}>
        <S.LogoImage src={logoSvg} $height={markHeight} alt="Zonds Logo" className={className} />
        <S.StackedText>
          <Text variant="h4" weight="bold" color="sidebar.foreground">
            ZonDS
          </Text>
          <Text variant="caption" color="sidebar.textMuted">
            Dropship Automation
          </Text>
        </S.StackedText>
      </S.StackedWrapper>
    );
  }

  const resolvedHeight = height ?? size ?? 40;
  return (
    <S.DefaultWrapper onClick={onClick}>
      <S.LogoImage src={logoSvg} $height={resolvedHeight} alt="Zonds Logo" className={className} />
    </S.DefaultWrapper>
  );
};
