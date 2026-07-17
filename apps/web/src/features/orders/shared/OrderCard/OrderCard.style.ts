import { type Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

import type { OrderCardStatTone } from './OrderCard.types';

/** Horizontal product card — mirrors ListingCard elevated language */
export const Wrapper = styled.button`
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
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  box-sizing: border-box;
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  font: inherit;
  color: inherit;

  &:hover {
    box-shadow: ${tkn('shadows.md')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const Image = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  background: transparent;
  border-radius: ${tkn('radius.sm')};
  width: 7.5rem;
  height: 7.5rem;
  align-self: flex-start;

  @media (min-width: 30rem) {
    width: 10.5rem;
    height: 10.5rem;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
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
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
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

  @media (min-width: 30rem) {
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
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.sm')};
  padding: ${tkn('spacing.sm')};
  margin-top: auto;
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
