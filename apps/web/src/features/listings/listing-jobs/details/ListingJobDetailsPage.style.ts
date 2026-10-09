import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

type ProgressTone = 'default' | 'active' | 'positive' | 'negative';

/* ── Summary — same quiet pane as JobCard / ListingCard ── */
/* The listing detail hero's blue wash over the glass, fading out by 65%
   (operator choice: blue, whatever the job's state). */
export const SummaryCard = styled(Card)`
  padding: 0;
  overflow: hidden;
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
`;

export const SummaryTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.xl')};
  }
`;

export const SummaryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  min-width: 0;
`;

export const SummaryBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(8.5rem, 0.72fr);
  align-items: start;
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  min-width: 0;
  @media (max-width: ${tkn('breakpoints.lg')}) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  /* A phone: the record facts across the top, then the counts on the left and
     the progress figure on their right (operator, 2026-10-09) — stacked, the
     figure fell to the foot of the card. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;

    & > :first-child {
      grid-column: 1 / -1;
    }
  }
`;

export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
  min-width: 0;
`;
export const MetaRow = styled.div` display: contents; `;
export const MetaValue = styled.dd`
  margin: 0; min-width: 0; overflow-wrap: anywhere;
  &&, && * { font-weight: ${tkn('typography.fontWeight.bold')}; }
`;
export const MetaLabel = styled.dt`
  margin: 0; display: flex; align-items: center; min-width: 0; white-space: nowrap;
`;
export const MonoId = styled(UIText)`
  display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ${tkn('typography.fontFamily.mono')};
`;
const progressPulse = keyframes`
  0%, 100% { opacity: 0.35; transform: scale(0.75); }
  50% { opacity: 1; transform: scale(1); }
`;
export const ProgressSignal = styled.div`
  display: flex; align-items: center; justify-content: flex-end; gap: ${tkn('spacing.sm')}; min-width: 0; align-self: center;
  @media (max-width: ${tkn('breakpoints.lg')}) { grid-column: 1 / -1; justify-content: flex-start; align-self: stretch; }
  /* A phone: beside the counts, not under them (see SummaryBody). */
  @media (max-width: ${tkn('breakpoints.smBelow')}) { grid-column: auto; justify-content: flex-end; align-self: center; }
`;
export const ProgressDot = styled.span<{ $tone: ProgressTone; $active: boolean }>`
  width: ${tkn('spacing.sm')}; height: ${tkn('spacing.sm')}; flex: 0 0 auto; border-radius: ${tkn('radius.full')};
  background: ${({ $tone, theme }) => {
    if ($tone === 'positive') {return theme.colors.semantic.success;}
    if ($tone === 'negative') {return theme.colors.semantic.error;}
    if ($tone === 'active') {return theme.colors.brand.primary;}
    return theme.colors.text.tertiary;
  }};
  ${({ $active }) => $active && css` animation: ${progressPulse} 1.2s ease-in-out infinite; `}
  @media (prefers-reduced-motion: reduce) { animation: none; opacity: 1; transform: none; }
`;
export const ProgressCopy = styled.div`
  display: flex; flex-direction: column; align-items: flex-end; gap: ${tkn('spacing.2xs')};
  @media (max-width: ${tkn('breakpoints.smBelow')}) { align-items: flex-start; }
`;
export const ProgressValue = styled(UIText)<{ $tone: ProgressTone }>`
  color: ${({ $tone, theme }) => {
    if ($tone === 'positive') {return theme.colors.semantic.success;}
    if ($tone === 'negative') {return theme.colors.semantic.error;}
    if ($tone === 'active') {return theme.colors.brand.primary;}
    return theme.colors.text.primary;
  }};
`;
export const StatValue = styled(UIText)<{ $tone?: 'default' | 'positive' | 'negative' }>`
  color: ${({ $tone, theme }) => {
    if ($tone === 'positive') {return theme.colors.semantic.success;}
    if ($tone === 'negative') {return theme.colors.semantic.error;}
    return theme.colors.text.primary;
  }};
`;
export const ItemsSection = styled.div` display: flex; flex-direction: column; gap: ${tkn('spacing.md')}; min-width: 0; `;
export const FilterBar = styled.div`
  display: flex; align-items: center; gap: ${tkn('spacing.md')}; flex-wrap: wrap; min-width: 0;
  @media (max-width: ${tkn('breakpoints.lg')}) { flex-direction: column; align-items: stretch; gap: ${tkn('spacing.sm')}; }
`;
export const SearchWrapper = styled.div`
  min-width: 0; width: 18rem; flex-shrink: 0;
  @media (max-width: ${tkn('breakpoints.lg')}) { width: 100%; }
`;
export const SelectWrapper = styled.div`
  min-width: 0; width: 17rem; flex-shrink: 0;
  @media (max-width: ${tkn('breakpoints.lg')}) { width: 100%; }
`;
export const EmptyWrap = styled.div` display: flex; align-items: center; justify-content: center; min-height: 10rem; `;
export const FailureCell = styled.div` display: flex; flex-direction: column; gap: ${tkn('spacing.2xs')}; `;
