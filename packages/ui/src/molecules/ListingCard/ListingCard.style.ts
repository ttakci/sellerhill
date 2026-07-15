import { type Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { Card } from '../../atoms/Card';
import { Text } from '../../atoms/Text';
import { tkn } from '../../theme/tkn';

import type { ListingCardOrientation, StatTone } from './ListingCard.types';

export const Wrapper = styled(Card)<{ $orientation: ListingCardOrientation }>`
  padding: ${tkn('spacing.lg')};
  display: flex;
  gap: ${tkn('spacing.lg')};
  height: 100%;
  width: 100%;
  border: none;
  cursor: ${({ onClick }) => (onClick ? 'pointer' : 'default')};

  ${({ $orientation }) =>
    $orientation === 'horizontal'
      ? `flex-direction: row; align-items: stretch;`
      : `flex-direction: column;`}

  &:hover {
    border: none;
  }
`;

export const Image = styled.div<{ $orientation: ListingCardOrientation }>`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};

  ${({ $orientation, theme }) =>
    $orientation === 'horizontal'
      ? `width: 8.5rem; height: 8.5rem;`
      : `width: 100%; aspect-ratio: 16 / 9; border: 0.0625rem solid ${tkn('colors.border.secondary')({ theme })};`}

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
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
  ${({ $orientation }) => ($orientation === 'horizontal' ? '' : 'min-height: 0;')}
`;

export const Title = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const Brand = styled(Text)``;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  align-items: center;
`;

export const ExtraFields = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ExtraItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.xs+')};
  margin-top: ${tkn('spacing.xs')};
`;

export const StatCell = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};

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
`;

export const Footer = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.sm')};
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;
