import styled from '@emotion/styled';
import React from 'react';

import logoMarkSvg from '../../assets/logo-mark.svg';
import logoVectorSvg from '../../assets/logo-vector.svg';

interface LogoProps {
  /** Logo height in pixels. Width scales automatically. */
  height?: number;
  /** @deprecated Use `height` instead. */
  size?: number;
  className?: string;
  /** Show compact Z icon mark only (for navbar, footer). Default shows full logo. */
  compact?: boolean;
}

const Image = styled.img<{ $height: number }>`
  height: ${(props) => props.$height / 16}rem;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  display: block;
`;

export const Logo: React.FC<LogoProps> = ({ height, size, className, compact }) => {
  const resolvedHeight = height ?? size ?? 40;
  const src = compact ? logoMarkSvg : logoVectorSvg;
  return <Image src={src} $height={resolvedHeight} alt="Zonds Logo" className={className} />;
};
