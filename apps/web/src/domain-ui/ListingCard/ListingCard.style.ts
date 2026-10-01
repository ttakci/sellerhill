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
`;

/**
 * Title row first (title left, status badge right); then the photo on the
 * LEFT with the facts beside it (horizontal), or the photo above (vertical).
 * See OrderCard — the two cards share one anatomy (CLAUDE.md "Card anatomy").
 */
export const Top = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

/** Checkbox · one-line title · status badge on the right; badges may wrap under on a phone. */
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
        width: 6.5rem;
        height: 6.5rem;
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
        width: 5rem;
        height: 5rem;
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

/** Status badge pinned to the title row's right edge. */
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
  align-items: center;
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
`;

export const MetaValueText = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** Price · profit · ROI · stock, under one hairline. */
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;
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
