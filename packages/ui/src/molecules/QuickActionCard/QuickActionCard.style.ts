import { type Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { QuickActionCardVariant } from './QuickActionCard.types';

export const Container = styled.div<{ $variant: QuickActionCardVariant }>`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  cursor: pointer;
  user-select: none;
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* 2px lift */
  }

  /* Nudge the trailing arrow circle on hover (no background change). */
  &:hover > :last-child {
    transform: translateX(0.125rem); /* 2px */
  }

  &:active {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
  }
`;

/** Title + optional subtitle, left-aligned, stacked. */
export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** Circular accent holding the trailing arrow-right. */
export const ArrowCircle = styled.div<{ $variant: QuickActionCardVariant }>`
  width: 2.5rem; /* 40px */
  height: 2.5rem; /* 40px */
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
  background: ${({ theme, $variant }: { theme: Theme; $variant: QuickActionCardVariant }) =>
    $variant === 'brand' ? `${theme.colors.brand.primary}15` : theme.colors.background.tertiary};
  color: ${({ theme, $variant }: { theme: Theme; $variant: QuickActionCardVariant }) =>
    $variant === 'brand' ? theme.colors.brand.primary : theme.colors.text.secondary};
`;
