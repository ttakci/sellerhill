import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

/*
 * Pure conic-gradient ring — no SVG, no extra dependency, both colours are
 * tokens. Shared by the job list card and the job detail summary card so the
 * two surfaces show the exact same progress affordance.
 */
export const Ring = styled.div<{ $percent: number }>`
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

export const RingValue = styled(Text)`
  position: relative;
  line-height: 1;
`;
