import styled from '@emotion/styled';
import { glassSurface, Text, tkn } from '@repo/ui';

/** Stage · meaning · action. On a phone each row stacks, badge first. */
export const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(9rem, auto) 1fr 1fr;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  align-items: start;

  @media (max-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xs')};

    /* Separate the stacked rows from each other once there are no columns. */
    & > *:nth-of-type(3n + 1):not(:first-of-type) {
      margin-top: ${tkn('spacing.md')};
    }
  }
`;

/** The two prose column headers have nothing to head on a phone. */
export const HeaderCell = styled(Text)`
  @media (max-width: ${tkn('breakpoints.sm')}) {
    display: none;
  }
`;

/** The opened legend: a glass pane under the tab row, as wide as the row. */
export const Panel = styled.div`
  ${({ theme }) => glassSurface(theme)}
  flex: 1 0 100%;
  box-sizing: border-box;
  padding: ${tkn('spacing.md+')};
  border-radius: ${tkn('radius.lg')};
`;

/** Keeps the badge at its natural width instead of stretching across the grid cell. */
export const BadgeCell = styled.div`
  display: flex;
  justify-content: flex-start;
`;

export const Chevron = styled.span<{ $isOpen: boolean }>`
  display: inline-flex;
  transition: transform ${tkn('transitions.fast')};
  transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
`;
