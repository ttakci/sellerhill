import styled from '@emotion/styled';
import { glassSurface, tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-height: 100%;
`;

/** One card per revision — the same frosted pane every drawer section uses,
 * lifting off the drawer's slate canvas. */
export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Card = styled.div`
  ${({ theme }) => glassSurface(theme)}
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: 0;
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
`;

/** Date ribbon — left-accented, timed feel. Sits full-bleed at card top. */
export const DateRibbon = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.glass.tint')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-left: 0.1875rem solid ${tkn('colors.brand.primary')};
`;

export const DateRibbonIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  flex-shrink: 0;
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
`;

export const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** Change rows — no extra divider, DateRibbon already separates. */
export const ChangeStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** label | previous → next | delta pill — collapses to two lines on a phone. */
export const ChangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ChangeLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  flex: 0 0 6.5rem;
`;

/** Product identity + "go to listing" — shown only when the drawer is opened
 * from a cross-listing surface (the Revision History table), where the
 * drawer is otherwise the only place still showing which product is open. */
export const Subject = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const SubjectCell = styled.div`
  min-width: 0;
  flex: 1 1 auto;
`;

export const ChangeValues = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const Arrow = styled.span<{ $tone: 'up' | 'down' | 'flat' }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ $tone, theme }) => {
    if ($tone === 'up') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'down') {
      return theme.colors.semantic.error;
    }
    return theme.colors.text.tertiary;
  }};
`;

/** Compact +/- change chip, tinted by direction. */
export const DeltaPill = styled.span<{ $tone: 'up' | 'down' }>`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.sm')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-variant-numeric: tabular-nums;
  color: ${({ $tone, theme }) =>
    $tone === 'up' ? theme.colors.semantic.success : theme.colors.semantic.error};
  background: ${({ $tone, theme }) =>
    $tone === 'up' ? theme.colors.semanticTint.success : theme.colors.semanticTint.error};
`;

/** "No change" note, right-aligned to sit where the delta pill would. */
export const MutedNote = styled.span`
  margin-left: auto;
`;

export const LoadMoreRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.xs')};
`;

export const EmptyWrap = styled.div`
  padding: ${tkn('spacing.xl')} 0;
`;
