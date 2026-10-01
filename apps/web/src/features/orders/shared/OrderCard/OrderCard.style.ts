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

/**
 * The card body (2026-10-01, the operator's final anatomy): the title row
 * first — title on the left, one line, cut with an ellipsis (the full text is
 * on the tooltip), the stage and its chips on the RIGHT of the same row —
 * then the photo on the LEFT with the facts beside it, then the figures row.
 * No stacking breakpoint: on a phone the photo gets smaller and the badges
 * may wrap under the title, still right-aligned.
 */
export const Top = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Block host for the tooltip so the one-line title can shrink and truncate. */
export const TitleSlot = styled.div`
  display: flex;
  flex: 1 1 12rem;
  min-width: 0;

  & > * {
    min-width: 0;
    max-width: 100%;
  }
`;

export const Body = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
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

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 5rem;
    height: 5rem;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
`;

/** One line, ellipsis — the full title is on the tooltip. */
export const Title = styled(Text)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

/** The stage badge and the chips that qualify it, pinned to the title row's right edge. */
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
  flex: 0 1 auto;
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
