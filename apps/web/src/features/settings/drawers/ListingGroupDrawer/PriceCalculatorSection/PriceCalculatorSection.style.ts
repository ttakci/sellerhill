import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export { FormCard } from '../../shared/drawerSurfaces.style';

export const Row = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${tkn('spacing.md')};

  & > * {
    flex: 1;
    min-width: 0;
  }
`;

/**
 * The input beside it is a labeled `size="small"` field, which renders at
 * `controls.height.smallLabeled` (52px) — not any of Button's own compact
 * heights (small/medium/large are all shorter or the wrong one). Reusing the
 * same token, rather than a new number, is what keeps them pinned together
 * if the scale ever changes.
 */
export const CalculateButton = styled(Button)`
  height: ${tkn('controls.height.smallLabeled')};
`;

/** "Show your work" list — each step of the formula, ending in the final price. */
export const BreakdownList = styled.div`
  display: flex;
  flex-direction: column;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  overflow: hidden;
`;

export const BreakdownRow = styled.div<{ $emphasis?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${({ $emphasis }) => ($emphasis ? tkn('spacing.md') : tkn('spacing.sm-md'))} ${tkn('spacing.lg')};
  ${({ $emphasis, theme }) =>
    $emphasis
      ? `border-top: 0.0625rem solid ${tkn('colors.border.primary')({ theme })}; background: ${tkn('colors.surface.primary')({ theme })};`
      : ''}
`;
