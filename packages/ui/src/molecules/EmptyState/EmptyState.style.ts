import { keyframes, type Theme } from '@emotion/react';
import styled from '@emotion/styled';

import type { MessageType } from '../../context';
import { tkn } from '../../theme/tkn';

import type { EmptyStateSize } from './EmptyState.types';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const EmptyStateWrapper = styled.div<{ $size: EmptyStateSize }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ $size, theme }) =>
    $size === 'sm'
      ? `${tkn('spacing.md')({ theme })} ${tkn('spacing.sm')({ theme })}`
      : `${tkn('spacing.xl')({ theme })} ${tkn('spacing.md')({ theme })}`};
  gap: ${({ $size }) => ($size === 'sm' ? tkn('spacing.sm') : $size === 'lg' ? tkn('spacing.lg') : tkn('spacing.md'))};
`;

/** Mirrors `Dialog`'s own type -> disc colour mapping, token for token. */
const resolveToneFill = (tone: MessageType, theme: Theme): string => {
  switch (tone) {
    case 'success':
      return theme.colors.semantic.success;
    /* Warning shares error's red — cautionary reads red in this design system. */
    case 'error':
    case 'warning':
      return theme.colors.semantic.error;
    case 'info':
    default:
      return theme.colors.brand.primary;
  }
};

/**
 * Two treatments, one disc.
 *
 * Default (no `$tone`): the pale brand-tinted circle with a brand-coloured
 * outline glyph every empty/loading surface uses.
 *
 * With `$tone`: the exact disc `Dialog` paints — a solid semantic fill with a
 * white glyph — so a failure screen carries the same mark as the error popup
 * (`MessageModal`) instead of a second, softer dialect of it. Colours are read
 * from the same tokens and mapped the same way Dialog maps them (warning shares
 * error's red, per that design).
 */
export const IconCircle = styled.div<{
  $size: EmptyStateSize;
  $tone?: MessageType;
  $spin?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '5.5rem' : '4.5rem')};
  height: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '5.5rem' : '4.5rem')};
  border-radius: ${tkn('radius.full')};
  background: ${({ theme, $tone }) => ($tone ? resolveToneFill($tone, theme) : `${theme.colors.brand.primary}14`)};
  border: 0.0625rem solid
    ${({ theme, $tone }) => ($tone ? resolveToneFill($tone, theme) : `${theme.colors.brand.primary}28`)};
  color: ${({ theme, $tone }) => ($tone ? theme.colors.text.inverse : theme.colors.brand.primary)};
  margin-bottom: ${tkn('spacing.xs')};

  /* Glyph SIZE is passed to the Icon atom as a prop, never set from here: Icon
     renders its own wrapper and sizes the svg itself, so a descendant
     'svg { width }' rule loses the cascade and silently does nothing. It did —
     every disc drew Icon's 20px default while the disc scaled around it. */
  svg {
    /* A stroke glyph must read as a solid white mark on a filled disc — the same
       override Dialog applies to its own icon. */
    ${({ theme, $tone }) => ($tone ? `stroke: ${theme.colors.text.inverse};` : '')}
    animation: ${({ $spin }) => ($spin ? spin : 'none')} 1s linear infinite;
  }
`;

/** Layout wrappers — typography lives on nested Text atoms */
export const Title = styled.div<{ $size: EmptyStateSize }>`
  margin: 0;
  max-width: 28rem;
`;

export const Description = styled.div<{ $size: EmptyStateSize }>`
  margin: 0;
  max-width: 28rem;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

/**
 * Full width only below `sm` — same reasoning as InfoMessage's `ActionSlot`:
 * a right-sized pill button centered on a phone is a small, easy-to-miss tap
 * target, so it spans the row like every other primary mobile action in this
 * app. `& > button` is a plain DOM child selector, not an Emotion
 * component-selector interpolation, so it needs no babel plugin — Button's
 * root element is a real `<button>`.
 */
export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;

    & > button {
      width: 100%;
    }
  }
`;
