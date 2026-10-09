import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Its own pane inside the card: a header line, then the chart with a date axis. */
export const Pane = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')} ${tkn('spacing.xs')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  min-width: 0;
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

export const Chart = styled.div`
  height: 6rem;
  min-width: 0;
  cursor: crosshair;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    height: 5rem;
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
