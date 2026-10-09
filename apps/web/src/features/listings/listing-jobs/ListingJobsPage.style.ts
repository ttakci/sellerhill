import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const FilterBarWrapper = styled.div`
  margin-bottom: 0;
`;

export const FilterBar = styled.div`
  /* The controls sit on the page canvas — no card of their own, so the first
     row of data is the first surface on the page (see the orders list). */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 16rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 12rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;
  min-height: ${tkn('controls.height.medium')};

  /* Nothing to clear: no empty control-high box (on a phone it left a gap under the filters). */
  &:empty {
    display: none;
  }

  @media (max-width: ${tkn('breakpoints.lg')}) {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
`;

export const ResultCount = styled(UIText)``;

/** Same quiet pane anatomy as listing/order cards: facts, then one footer strip. */
export const JobCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: translateY(-0.125rem);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const JobCardTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

export const JobCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Tells the seller the whole card opens the job. */
export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;

export const FooterActions = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  flex: 0 0 auto;
  margin-left: auto;

  /* Always the last column of the figures row, even when "Remaining" is not shown. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-column: -2 / -1;
    margin-left: 0;
  }
`;

export const JobCardBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8.5rem, 0.72fr);
  align-items: end;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
  flex: 1;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

/** Label/value facts follow the exact reading pattern of listing/order cards. */
export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
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

  && * {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

type ProgressTone = 'default' | 'active' | 'positive' | 'negative';

const progressPulse = keyframes`
  0%, 100% {
    opacity: 0.35;
    transform: scale(0.75);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
`;

/** One strong signal at the right edge; no ring, bar or duplicate count. */
export const ProgressSignal = styled.div<{ $tone: ProgressTone; $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  align-self: center;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    justify-content: flex-start;
    align-self: stretch;
  }
`;

export const ProgressDot = styled.span<{ $tone: ProgressTone; $active: boolean }>`
  width: ${tkn('spacing.sm')};
  height: ${tkn('spacing.sm')};
  flex: 0 0 auto;
  border-radius: ${tkn('radius.full')};
  background: ${({ $tone, theme }) => {
    if ($tone === 'positive') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'negative') {
      return theme.colors.semantic.error;
    }
    if ($tone === 'active') {
      return theme.colors.brand.primary;
    }
    return theme.colors.text.tertiary;
  }};
  ${({ $active }) =>
    $active &&
    css`
      animation: ${progressPulse} 1.2s ease-in-out infinite;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
    transform: none;
  }
`;

export const ProgressCopy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    align-items: flex-start;
  }
`;

export const ProgressValue = styled(UIText)<{ $tone: ProgressTone }>`
  color: ${({ $tone, theme }) => {
    if ($tone === 'positive') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'negative') {
      return theme.colors.semantic.error;
    }
    if ($tone === 'active') {
      return theme.colors.brand.primary;
    }
    return theme.colors.text.primary;
  }};
`;

/** Success / failed / remaining — label over value, under one hairline. */
export const StatsGrid = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;

  /* Three figures and the detail hint on ONE row — the hint used to drop onto its own line. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
    align-items: center;
    column-gap: ${tkn('spacing.sm')};
  }
`;

export const StatCell = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatLabel = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const StatValue = styled(UIText)<{ $tone?: 'default' | 'positive' | 'negative' }>`
  color: ${({ $tone, theme }) => {
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

/** Compact progress cell for table */
export const TableProgress = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 7.5rem;
  max-width: 11rem;
`;

export const TableStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

export const MonoId = styled(UIText)`
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${tkn('typography.fontFamily.mono')};
`;
