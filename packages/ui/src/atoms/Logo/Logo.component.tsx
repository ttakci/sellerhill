import React from 'react';

/** Full mark with tagline — auth / landing */
import logoFull from '../../assets/logo-mark.svg';
/** ZonDS only (no slogan) — app sidebar / navbar */
import logoNav from '../../assets/logo-nav.svg';

import * as S from './Logo.style';

export interface LogoProps {
  /** Render height in px; width scales with aspect ratio. */
  height?: number;
  /** @deprecated Use `height`. */
  size?: number;
  className?: string;
  /**
   * - `default` / `full` — original mark + slogan (login, register, landing)
   * - `nav` — ZonDS only, no slogan (sidebar)
   * - `wordmark` / `stacked` — aliases of `nav` (compat)
   */
  layout?: 'default' | 'full' | 'nav' | 'wordmark' | 'stacked';
  onClick?: () => void;
}

export const Logo: React.FC<LogoProps> = ({
  height,
  size,
  className,
  layout = 'default',
  onClick,
}) => {
  const resolvedHeight = height ?? size ?? 40;
  const useNav = layout === 'nav' || layout === 'wordmark' || layout === 'stacked';

  return (
    <S.DefaultWrapper onClick={onClick}>
      <S.LogoImage
        src={useNav ? logoNav : logoFull}
        $height={resolvedHeight}
        alt="Zonds Logo"
        className={className}
      />
    </S.DefaultWrapper>
  );
};
