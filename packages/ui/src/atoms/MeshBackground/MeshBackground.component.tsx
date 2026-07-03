import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import React, { useMemo } from 'react';

import { tkn } from '../../theme/tkn';

const fluidAnimation = keyframes`
  0% { transform: scale(1) translate(0, 0); }
  33% { transform: scale(1.1) translate(-2%, 2%); }
  66% { transform: scale(0.9) translate(2%, -2%); }
  100% { transform: scale(1) translate(0, 0); }
`;

const particleAnimation = keyframes`
  0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
  20% { opacity: 0.6; }
  80% { opacity: 0.6; }
  100% { transform: translate(var(--tx), var(--ty)) rotate(var(--tr)); opacity: 0; }
`;

const Container = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: ${tkn('colors.landing.heroBg')};
  z-index: 0;
  pointer-events: none;
`;

const Mesh = styled.div<{ $animate: boolean }>`
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background-image: ${({ theme }) => `
    radial-gradient(circle at 70% 30%, ${theme.colors.brand.primary} 0%, transparent 50%),
    radial-gradient(circle at 30% 70%, ${theme.colors.brand.primaryHover} 0%, transparent 50%),
    radial-gradient(circle at 10% 20%, ${theme.colors.semantic.info} 0%, transparent 40%),
    radial-gradient(circle at 80% 80%, ${theme.colors.brand.primary} 0%, transparent 45%)
  `};
  filter: blur(3.75rem); /* 60px */
  opacity: 0.7; /* Increased from 0.6 */
  ${({ $animate }) =>
    $animate &&
    css`
      animation: ${fluidAnimation} 25s infinite ease-in-out;
    `}
`;

const Particle = styled.div<{
  size: number;
  tx: number;
  ty: number;
  tr: number;
  top: number;
  left: number;
  delay: number;
  $animate: boolean;
}>`
  position: absolute;
  width: ${(props) => props.size / 16}rem;
  height: ${(props) => props.size / 16}rem;
  background: white;
  border-radius: 50%;
  opacity: 0;
  filter: blur(0.125rem); /* 2px */
  --tx: ${(props) => props.tx / 16}rem;
  --ty: ${(props) => props.ty / 16}rem;
  --tr: ${(props) => props.tr}deg;
  top: ${(props) => props.top}%;
  left: ${(props) => props.left}%;

  ${({ $animate, delay }) =>
    $animate
      ? css`
          animation: ${particleAnimation} 15s infinite ease-in-out;
          animation-delay: ${delay}s;
        `
      : css`
          opacity: 0.2;
          transform: translate(var(--tx), var(--ty)) rotate(var(--tr));
        `}
`;

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at center, transparent 0%, ${tkn('colors.surface.overlay')} 100%);
  pointer-events: none;
`;

const particlesCount = 15;
const generateParticles = () =>
  Array.from({ length: particlesCount }).map((_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    tx: (Math.random() - 0.5) * 400,
    ty: (Math.random() - 0.5) * 400,
    tr: Math.random() * 360,
    delay: Math.random() * 15,
    top: Math.random() * 100,
    left: Math.random() * 100,
  }));

interface MeshBackgroundProps {
  animate?: boolean;
}

export const MeshBackground: React.FC<MeshBackgroundProps> = ({ animate = true }) => {
  const particles = useMemo(() => generateParticles(), []);

  return (
    <Container>
      <Mesh $animate={animate} />
      {particles.map((p) => (
        <Particle
          key={p.id}
          size={p.size}
          tx={p.tx}
          ty={p.ty}
          tr={p.tr}
          top={p.top}
          left={p.left}
          delay={p.delay}
          $animate={animate}
        />
      ))}
      <Overlay />
    </Container>
  );
};
