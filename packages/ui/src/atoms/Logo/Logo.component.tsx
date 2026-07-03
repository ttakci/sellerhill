import styled from '@emotion/styled';
import React from 'react';

import logoSvg from '../../assets/logo.svg';

interface LogoProps {
  /** Logo height in pixels. Width is calculated automatically to preserve aspect ratio. */
  height?: number;
  /** @deprecated Use `height` instead. Maps to height for backward compat. */
  size?: number;
  className?: string;
  variant?: 'light' | 'dark';
}

const Image = styled.img<{ $height: number }>`
  height: ${(props) => props.$height / 16}rem;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  display: block;
`;

export const Logo: React.FC<LogoProps> = ({ height, size, className }) => {
  const resolvedHeight = height ?? size ?? 40;
  return <Image src={logoSvg} $height={resolvedHeight} alt="Zonds Logo" className={className} />;
};
