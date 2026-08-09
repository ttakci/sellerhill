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

export const LauncherButton = styled(Button)`
  position: relative;
`;

export const CollapsedLauncher = styled(IconButton)`
  position: relative;
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
