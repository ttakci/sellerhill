import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Its own pane inside the card: a header line, then the chart with a date axis. */
export const Pane = styled.div<{ $compact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  width: 100%;

  ${({ $compact, theme }) =>
    $compact
      ? ''
      : `
    padding: ${theme.spacing.sm} ${theme.spacing['sm-md']} ${theme.spacing.xs};
    border: 0.0625rem solid ${theme.colors.border.primary};
    border-radius: ${theme.radius.md};
    background: ${theme.colors.surface.primary};
  `}
`;

export const Header = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;

  > * {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const Chart = styled.div<{ $compact: boolean }>`
  height: ${({ $compact }) => ($compact ? '4rem' : '6rem')};
  min-width: 0;
  cursor: crosshair;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    height: ${({ $compact }) => ($compact ? '4rem' : '5rem')};
  }
`;

export const TooltipCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('shadows.lg')};
`;

export const TooltipRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;
