import React from 'react';

import * as S from './Logo.style';
import type { LogoProps } from './Logo.types';

const LOGO_ASSET_URL = '/logo.svg';
const LOGO_WIDTH = 3949.53;
const LOGO_HEIGHT = 836.86;

const WORDMARK_ASSET_URL = '/logo-wordmark.svg';
const WORDMARK_WIDTH = 2907.35;
const WORDMARK_HEIGHT = 358.73;

export const Logo: React.FC<LogoProps> = ({ height, size, className, layout = 'default', onClick }) => {
  const isWordmark = layout === 'wordmark';
  const assetUrl = isWordmark ? WORDMARK_ASSET_URL : LOGO_ASSET_URL;
  const aspectWidth = isWordmark ? WORDMARK_WIDTH : LOGO_WIDTH;
  const aspectHeight = isWordmark ? WORDMARK_HEIGHT : LOGO_HEIGHT;

  const resolvedHeight = height ?? size ?? 40;
  const resolvedWidth = (resolvedHeight * aspectWidth) / aspectHeight;

  return (
    <S.DefaultWrapper onClick={onClick} className={className}>
      <S.LogoImage src={assetUrl} width={resolvedWidth} height={resolvedHeight} alt="SellerHill" />
    </S.DefaultWrapper>
  );
};
