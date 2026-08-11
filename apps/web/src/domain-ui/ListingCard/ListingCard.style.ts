import { type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

import type { ListingCardOrientation, StatTone } from './ListingCard.types';

export const Wrapper = styled(Card)<{
  $orientation: ListingCardOrientation;
  $selected?: boolean;
}>`
  position: relative;
  box-sizing: border-box;
  padding: ${tkn('spacing.lg')};
  display: flex;
  gap: ${tkn('spacing.lg')};
  height: 100%;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  /* SettingsCard surface: primary border + sm elevation (from elevated variant) */
  border: 0.0625rem solid
    ${({ $selected, theme }) =>
      $selected ? theme.colors.brand.primary : theme.colors.border.primary};
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `flex-direction: row; align-items: stretch;`
      : `flex-direction: column;`}

  &:hover {
    border-color: ${({ $selected, theme }) =>
      $selected ? theme.colors.brand.primary : theme.colors.border.primary};
    box-shadow: ${tkn('shadows.md')};
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
        width: 10.5rem;
        height: 10.5rem;
        align-self: flex-start;
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
`;

export const Content = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
  overflow: hidden;
  ${({ $orientation }) => ($orientation === 'horizontal' ? '' : 'min-height: 0;')}
`;

export const HeaderBlock = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: ${tkn('spacing.md')};
`;

export const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.sm')};
  align-items: baseline;
  min-width: 0;
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
    font-weight: ${tkn('typography.fontWeight.bold')};
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
  font-family: ${tkn('typography.fontFamily.mono')};
`;

export const ExtraFields = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
  align-items: center;
`;

export const ExtraItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  color: ${tkn('colors.text.secondary')};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.sm')};
  padding: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

export const StatCell = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};
  min-width: 0;

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
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

export const Footer = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.sm')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

/** "Detay" label + arrow — the same trailing affordance the Settings carousels' cards use. */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
  flex-shrink: 0;
`;
