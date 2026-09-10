import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-height: 100%;
`;

/** One card per revision — same elevated white surface the other drawers use. */
export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** Divides the timestamp header from the change rows below it. */
export const ChangeStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

/** label | previous → next | delta pill — collapses to two lines on a phone. */
export const ChangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ChangeLabel = styled.span`
  flex: 0 0 3.5rem;
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
