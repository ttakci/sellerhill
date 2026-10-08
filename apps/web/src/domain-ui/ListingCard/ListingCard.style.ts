import { type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

import type { ListingCardOrientation, StatTone } from './ListingCard.types';

/**
 * One quiet pane, the same shape as OrderCard: photo + facts above a hairline,
 * the figures under it. No icon on any label, no tinted stat box, no
 * "Details →" footer — the whole card is the button.
 */
export const Wrapper = styled(Card)<{
  $orientation: ListingCardOrientation;
  $selected?: boolean;
}>`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  border-color: ${({ $selected, theme }) => ($selected ? theme.colors.brand.primary : theme.colors.glass.edge)};
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: ${({ onClick }) => (onClick ? 'translateY(-0.125rem)' : 'none')};
  }
`;

/** The checkbox sits in the title row, in flow — never floated over the photo or the title. */
export const SelectionControl = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  /* On a phone the photo leads the card, so the tick floats over its top-left corner. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    position: absolute;
    top: ${tkn('spacing.lg')};
    left: ${tkn('spacing.lg')};
    z-index: 1;
    padding: ${tkn('spacing.xs')};
    border-radius: ${tkn('radius.sm')};
    background: ${tkn('colors.surface.primary')};
    box-shadow: ${tkn('shadows.sm')};
  }
`;

/**
 * Badge row first (status pill, top-left — same as OrderCard), then the title
 * row; then the photo on the
 * LEFT with the facts beside it (horizontal), or the photo above (vertical).
 * See OrderCard — the two cards share one anatomy (CLAUDE.md "Card anatomy").
 */
export const Top = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

/** The status badge — top row, left-aligned, wrapping (like OrderCard BadgeRow). */
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -2;
  }
`;

/** Checkbox + one-line title row; badge lives above in BadgeRow. */
export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  min-width: 0;
`;

export const Body = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: ${({ $orientation }) => ($orientation === 'horizontal' ? 'row' : 'column')};
  align-items: ${({ $orientation }) => ($orientation === 'horizontal' ? 'flex-start' : 'stretch')};
  gap: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;

  /* A phone leaves no room for photo + facts side by side (values truncated to "Unb…"): stack them, photo first. */
  /* Its children become Top's own, so the photo can be ordered above the title row. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: contents;
  }
`;

export const Image = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  border-radius: ${tkn('radius.sm')};

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `
        width: 9rem;
        height: 9rem;
      `
      : `
        width: 100%;
        aspect-ratio: 1 / 1;
      `}

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    ${({ $orientation }) =>
      $orientation === 'horizontal'
        ? `
        order: -1;
        width: 100%;
        height: 10rem;
      `
        : `
        height: 9rem;
        aspect-ratio: auto;
      `}
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
  /* Breathing room from the photo. */
  padding-inline-start: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding-inline-start: 0;
  }
`;

/** Block-level host for the tooltip, so the one-line title can shrink and truncate. */
export const TitleSlot = styled.div`
  display: flex;
  flex: 1 1 12rem;
  min-width: 0;

  & > * {
    min-width: 0;
    max-width: 100%;
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
  display: flex;
  align-items: center;
  overflow: hidden;

  a {
    max-width: 100%;
    overflow: hidden;
  }

  /* Every value reads bold, including the ASIN / eBay ID badges. */
  && * {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

export const MetaValueText = styled(Text)<{ $multiline: boolean }>`
  overflow: hidden;
  text-overflow: ${({ $multiline }) => ($multiline ? 'clip' : 'ellipsis')};
  white-space: ${({ $multiline }) => ($multiline ? 'normal' : 'nowrap')};
  overflow-wrap: ${({ $multiline }) => ($multiline ? 'anywhere' : 'normal')};
`;

/** Sits above the figures row, inset like the Footer. */
export const Trend = styled.div`
  padding: 0 ${tkn('spacing.md+')} ${tkn('spacing.sm')};
`;

/** Same strip as OrderCard: figures + the detail hint in one grid, under one hairline. */
export const Footer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
`;

/** Tells the seller the whole card opens the detail page. */
export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  align-self: center;
  justify-self: end;
  gap: ${tkn('spacing.2xs')};
`;

export const StatCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatLabel = styled(Text)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const StatValueRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatValue = styled(Text)<{ $tone: StatTone }>`
  color: ${({ $tone, theme }: { theme: Theme; $tone: StatTone }) => {
    if ($tone === 'positive') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'negative') {
      return theme.colors.semantic.error;
    }
    if ($tone === 'info') {
      return theme.colors.semantic.info;
    }
    return theme.colors.text.primary;
  }};
  line-height: ${tkn('typography.lineHeight.tight')};
`;
