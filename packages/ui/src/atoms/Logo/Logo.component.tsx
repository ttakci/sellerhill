import styled from '@emotion/styled';
import React from 'react';
import logoSvg from '../../assets/logo.svg';

interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'light' | 'dark';
}

const Image = styled.img<{ $size: number }>`
  width: ${(props) => props.$size / 16}rem;
  height: auto;
  object-fit: contain;
  display: block;
`;

export const Logo: React.FC<LogoProps> = ({ size = 120, className }) => {
  return <Image src={logoSvg} $size={size} alt="Zonds Logo" className={className} />;
};
