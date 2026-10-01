import { css, type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { glassSurface, Text, tkn } from '@repo/ui';

import type { OrderCardStatTone } from './OrderCard.types';

/**
 * One quiet surface: product + facts above a hairline, the money row below it.
 * The grey stat box, the icon on every row, the mono bold values and the
 * "Details →" footer are gone — each was a second visual system inside one
 * card, and together they read as a template rather than a record.
 */
export const Wrapper = styled.button<{ $hoverEffect: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
  ${({ theme }) => glassSurface(theme)}
  border-radius: ${tkn('radius.lg')};
  box-sizing: border-box;
  overflow: hidden;
  transition:
    transform ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  font: inherit;
  color: inherit;

  ${({ $hoverEffect, theme }: { theme: Theme; $hoverEffect: boolean }) =>
    $hoverEffect &&
    css`
      &:hover {
        box-shadow: ${theme.shadows.glassHover};
        transform: translateY(-0.125rem);
      }
    `}

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

/** Image beside the facts; stacks on a phone where the two cannot share the width. */
export const Top = styled.div`
  display: flex;
  gap: ${tkn('spacing.md+')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
`;

export const Image = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  width: 6.5rem;
  height: 6.5rem;
  align-self: flex-start;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;
    height: 9rem;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
`;

/** The stage badge and the one-line chips that qualify it, on one wrapping row. */
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** Label / value pairs, no icons — the label column is the only ornament. */
export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: ${tkn('spacing.2xs')} 0 0;
  min-width: 0;
`;

export const MetaLabel = styled.dt`
  margin: 0;
  white-space: nowrap;
`;

export const MetaValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  a {
    max-width: 100%;
    overflow: hidden;
  }
`;

/** Sale · cost · profit, under one hairline. */
export const MoneyRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
`;

export const StatCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatValue = styled(Text)<{ $tone: OrderCardStatTone }>`
  color: ${({ $tone, theme }: { theme: Theme; $tone: OrderCardStatTone }) => {
    if ($tone === 'positive') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'negative') {
      return theme.colors.semantic.error;
    }
    return theme.colors.text.primary;
  }};
`;
