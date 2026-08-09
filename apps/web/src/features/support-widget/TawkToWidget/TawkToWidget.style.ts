import styled from '@emotion/styled';
import { Button, IconButton, tkn } from '@repo/ui';

export const LauncherCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.sidebar.active')};
  border: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  box-sizing: border-box;
`;

export const LauncherButtonAnchor = styled.div`
  position: relative;
`;

export const LauncherButton = styled(Button)``;

export const CollapsedLauncher = styled(IconButton)`
  position: relative;
`;

/**
 * `Tooltip`'s wrapper div becomes the actual flex item inside the sidebar
 * footer (column flex, default `align-items: stretch`) once the launcher is
 * wrapped in it — this anchor carries the centering the launcher itself used
 * to own directly, so wrapping it in a tooltip doesn't left-align it.
 */
export const CollapsedLauncherAnchor = styled.div`
  align-self: center;
`;

export const UnreadBadge = styled.span`
  position: absolute;
  top: 0;
  right: 0;
  min-width: ${tkn('spacing.md')};
  height: ${tkn('spacing.md')};
  padding: 0 ${tkn('spacing.2xs')};
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semantic.error')};
  color: ${tkn('colors.text.inverse')};
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transform: translate(35%, -35%);
`;
