import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const FilterBarWrapper = styled.div`
  margin-bottom: 0;
`;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
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

  @media (max-width: ${tkn('breakpoints.lg')}) {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
`;

export const ResultCount = styled(UIText)``;

/**
 * Dense job card — compact padding, inline stats, no large empty metric tiles.
 * Horizontal feel on tablet+ (meta left, progress fills).
 */
export const JobCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    border-color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const JobCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/* Replaces the old text that looked like a link but sat inside an already
   clickable card, so it was never independently focusable or actionable. */
export const OpenAffordance = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${tkn('colors.text.tertiary')};
  transition: color ${tkn('transitions.fast')};
`;

export const JobCardTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex-wrap: wrap;
`;

export const JobCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/*
 * Progress ring. Replaces the full-width bar: a horizontal line pinned the card
 * into a "header / line / stats / footer" stack with four equal-weight rows and
 * no focal point. The ring puts the one number that matters in the centre and
 * frees the row beside it for the count, so the card reads in one glance.
 *
 * Pure conic-gradient — no SVG, no extra dependency, and both colours are tokens.
 */
export const ProgressRing = styled.div<{ $percent: number }>`
  position: relative;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${({ $percent, theme }) =>
    `conic-gradient(${theme.colors.brand.primary} ${$percent}%, ${theme.colors.background.tertiary} 0)`};

  &::before {
    content: '';
    position: absolute;
    inset: 0.3125rem;
    border-radius: 50%;
    background: ${tkn('colors.surface.primary')};
  }
`;

export const ProgressRingValue = styled(UIText)`
  position: relative;
  line-height: 1;
`;

/** Ring + the counts that sit beside it. */
export const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const ProgressCounts = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/*
 * Success / failed / remaining. Was an inline run separated by a middot with
 * every value at caption size, so a figure never stood out from its own label.
 */
export const StatsInline = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.2xs')};
`;

export const StatInline = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const JobCardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
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
  gap: ${tkn('spacing.sm')};
`;

export const MonoId = styled(UIText)`
  font-family: ${tkn('typography.fontFamily.mono')};
`;

