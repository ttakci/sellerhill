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

export const SelectionControl = styled.div`
  position: absolute;
  top: ${tkn('spacing.sm')};
  left: ${tkn('spacing.sm')};
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/** Image beside (horizontal) or above (vertical) the facts. */
export const Top = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: ${({ $orientation }) => ($orientation === 'horizontal' ? 'row' : 'column')};
  gap: ${tkn('spacing.md+')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
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
  align-self: flex-start;

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `
        width: 7.5rem;
        height: 7.5rem;
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
    width: 100%;
    height: 9rem;
    aspect-ratio: auto;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
`;

/** Block-level host for the tooltip, so the clamped title keeps the full content width. */
export const TitleSlot = styled.div`
  display: flex;
  min-width: 0;
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

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
