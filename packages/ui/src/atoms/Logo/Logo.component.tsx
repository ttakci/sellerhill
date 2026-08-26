import React from 'react';

import * as S from './Logo.style';
import type { LogoProps } from './Logo.types';

const LOGO_ASSET_URL = '/logo.svg';
const LOGO_WIDTH = 3949.53;
const LOGO_HEIGHT = 836.86;

export const Logo: React.FC<LogoProps> = ({ height, size, className, layout: _layout = 'default', onClick }) => {
  const resolvedHeight = height ?? size ?? 40;
  const resolvedWidth = (resolvedHeight * LOGO_WIDTH) / LOGO_HEIGHT;

  return (
    <S.DefaultWrapper onClick={onClick} className={className}>
      <S.LogoImage src={LOGO_ASSET_URL} width={resolvedWidth} height={resolvedHeight} alt="SellerHill" />
    </S.DefaultWrapper>
  );
};
