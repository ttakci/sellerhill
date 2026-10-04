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

  @media (max-width: ${tkn('breakpoints.lg')}) {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
`;

export const ResultCount = styled(UIText)``;

/**
 * One pane: id + status, the progress ring, then the counts under a hairline.
 * No tinted stat box and no "Details →" footer — the whole card is the button.
 */
export const JobCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
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

/* Short job id top-left, status badge top-right — opposite corners of the
   same row instead of a separate labeled meta row further down the card. */
export const JobCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  padding: ${tkn('spacing.md+')} ${tkn('spacing.md+')} 0;
`;

export const JobTitleRow = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 0 ${tkn('spacing.md+')};
`;

/** Tells the seller the whole card opens the job. */
export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
  gap: ${tkn('spacing.2xs')};
`;

export const JobCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex: 1;
  padding: 0 ${tkn('spacing.md+')} ${tkn('spacing.md+')};
`;

/*
 * Replaces the old full-width bar: a horizontal line pinned the card into a
 * "header / line / stats / footer" stack with four equal-weight rows and no
 * focal point. The shared JobProgressRing puts the one number that matters
 * in the centre and frees the row beside it for the count, so the card reads
 * in one glance. Ring + counts on the left, the created date on the right.
 */
export const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const ProgressMain = styled.div`
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

/** The created date, and under it the store the job ran against. */
export const ProgressMeta = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  text-align: right;
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
  gap: ${tkn('spacing.sm')};
`;

export const MonoId = styled(UIText)`
  font-family: ${tkn('typography.fontFamily.mono')};
`;

