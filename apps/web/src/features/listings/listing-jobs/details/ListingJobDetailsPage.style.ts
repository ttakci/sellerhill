import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  box-sizing: border-box;
  overflow: hidden;
  width: 100%;
  max-width: 42rem;
`;

export const SummaryMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
`;

export const SummaryTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const SummaryBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(8.5rem, 0.4fr);
  align-items: end;
  gap: ${tkn('spacing.xl')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

export const SummaryFooter = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    align-items: stretch;
    flex-direction: column;
  }
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
`;

export const StatCell = styled.div`
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

export const MetaList = styled.div`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: contents;
`;

export const MetaValue = styled.div`
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: ${tkn('typography.fontWeight.bold')};

  &&,
  && * {
    font-weight: ${tkn('typography.fontWeight.bold')};
  }
`;

export const MetaLabel = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
`;

export const ItemsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 18rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

/* Wider than the job list's status select: the options carry a count and the
   longest label ("Kara liste dışı hatalar (3)") must not truncate. */
export const SelectWrapper = styled.div`
  min-width: 0;
  width: 17rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const ItemCard = styled(Card)`
  display: flex;
  flex-direction: column;
  padding: 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
`;

export const ItemCardTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

export const ItemCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: ${tkn('spacing.sm')};
`;

export const EmptyWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
`;

export const MonoId = styled(UIText)`
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${tkn('typography.fontFamily.mono')};
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

export const ProgressSignal = styled.div`
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

// `TechnicalDetails` was removed with the raw-error disclosure: the provider's
// own wording is operator diagnostics and now lives only in the admin
// listing-failures panel.

/** Localized reason stacked over the support reference — table view's reason
    column only (the grid card uses row-based Meta instead, see MetaRow). */
export const FailureCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;
