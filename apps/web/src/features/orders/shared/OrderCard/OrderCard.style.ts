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

  /* A phone leaves no room for photo + facts side by side: stack them, photo first (as the listing card). */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: contents;
  }
`;

export const Image = styled.div<{ $empty: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  width: 9rem;
  height: 9rem;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -1;
    width: 100%;
    /* No photo: a small placeholder, not a 10rem empty band. */
    height: ${({ $empty }) => ($empty ? '4rem' : '10rem')};
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
  /* Breathing room from the photo, like the listing card. */
  padding-inline-start: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding-inline-start: 0;
  }
`;

/** One line, ellipsis — the full title is on the tooltip. */
export const Title = styled(Text)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

/** The stage badge and the chips that qualify it: the card's top row, left-aligned, wrapping. */
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  /* On a phone the photo comes second, right under the badges. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -2;
  }
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

  /* Every value reads bold, including the ASIN / eBay ID badges (as on the listing card). */
  && * {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

/**
 * The figures strip under one hairline: the figures on the left, the detail
 * affordance in its own column on the right — as a cell of the figures grid
 * it dropped onto a line of its own on a phone.
 */
export const Footer = styled.div<{ $hasBadge: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  /* The badge straddling the hairline ("Estimated") reaches into the strip: clear the figure labels under it. */
  padding-top: ${({ $hasBadge, theme }) => ($hasBadge ? theme.spacing.lg : theme.spacing['sm-md'])};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
`;

export const FooterBadgeRow = styled.div`
  position: absolute;
  top: 0;
  left: ${tkn('spacing.md+')};
  transform: translateY(-60%);
  display: flex;
`;

/** Sale · cost · profit · ROI. */
export const MoneyRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  min-width: 0;

  /* A 360px phone fits three figures beside the detail hint only with a tighter gap. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    column-gap: ${tkn('spacing.sm')};
  }
`;

/** Tells the seller the whole card opens the order. */
export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
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
