import { css, type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

import type { OrderCardStatTone } from './OrderCard.types';

/** Horizontal product card — mirrors ListingCard elevated language */
export const Wrapper = styled.button<{ $hoverEffect: boolean }>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  height: 100%;
  max-width: 100%;
  min-width: 0;
  text-align: left;
  cursor: pointer;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  box-sizing: border-box;
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  font: inherit;
  color: inherit;

  ${({ $hoverEffect, theme }: { theme: Theme; $hoverEffect: boolean }) =>
    $hoverEffect &&
    css`
      &:hover {
        box-shadow: ${theme.shadows.md};
        border-color: ${theme.colors.brand.primary};
      }
    `}

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  /* Fixed-width image + row layout crushes content into ~130-150px on a
     360-375px viewport. Stack instead so both get the card's full width. */
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
  border-radius: ${tkn('radius.md')};
  width: 10.5rem;
  height: 10.5rem;
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
    height: auto;
    max-height: 12rem;
    align-self: stretch;
  }
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
  overflow: hidden;
`;

export const HeaderBlock = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  margin-bottom: ${tkn('spacing.md')};
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
`;

export const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.sm')};
  align-items: baseline;
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 5rem minmax(0, 1fr);
  }
`;

export const MetaLabel = styled(Text)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const MetaValue = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  overflow: hidden;

  a {
    max-width: 100%;
    overflow: hidden;
  }

  a > span:first-of-type {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const MetaValueText = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const StatsGrid = styled.div`
  position: relative;
  display: grid;
  /* Was a rigid repeat(3, 1fr) with vertical dividers, which is exactly what
     crushed at a narrow track: three currency values in ~55px each. Cells now
     reflow to two rows before they truncate. */
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.sm-md')};
  margin-top: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

export const StatsBadge = styled.div`
  position: absolute;
  top: ${tkn('spacing.xs')};
  right: ${tkn('spacing.xs')};
  z-index: 1;
`;

export const StatCell = styled.div`
  /* Left-aligned: centred values in a reflowing grid never line up with each
     other, and money reads better against a common left edge. */
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
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
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  flex-shrink: 0;
`;

/** "Detay" label + arrow — the same trailing affordance the Settings carousels' cards use. */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;
