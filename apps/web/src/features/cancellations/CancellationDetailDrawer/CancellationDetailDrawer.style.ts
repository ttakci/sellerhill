import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/* The canonical 32rem drawer panes, facts and journey rail — shared with the Returns drawer. */
export * from '@/features/returns/ReturnDetailDrawer/ReturnDetailDrawer.style';

/**
 * A journey marker by STATE, not by who acted: a step eBay recorded is green,
 * a step still ahead is a hollow grey ring. Colouring by actor made the
 * seller's (blue) step read as "stuck here" (operator, 2026-10-07); who acted
 * is written under the step.
 */
export const StepMarker = styled.span<{ $upcoming: boolean }>`
  display: block;
  flex-shrink: 0;
  box-sizing: border-box;
  width: 0.75rem;
  height: 0.75rem;
  margin-top: 0.3125rem;
  border-radius: ${tkn('radius.full')};
  border: 0.125rem solid
    ${({ $upcoming, theme }) => ($upcoming ? theme.colors.text.tertiary : theme.colors.semantic.success)};
  background: ${({ $upcoming, theme }) => ($upcoming ? 'transparent' : theme.colors.semantic.success)};
`;
