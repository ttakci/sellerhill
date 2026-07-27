import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export const PromoCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.sidebar.active')};
  border: 0.0625rem solid ${tkn('colors.sidebar.divider')};
  box-sizing: border-box;
`;

export const PanelRoot = styled.div<{ $minimized: boolean }>`
  position: fixed;
  right: ${tkn('spacing.lg')};
  bottom: ${tkn('spacing.lg')};
  z-index: 1200;
  width: min(25rem, calc(100vw - ${tkn('spacing.xl')}));
  height: ${({ $minimized }) => ($minimized ? 'auto' : 'min(38rem, calc(100vh - 6rem))')};
  display: flex;
  flex-direction: column;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.xl')};
  overflow: hidden;

  @media (max-width: 30rem) {
    inset: ${tkn('spacing.sm')};
    width: auto;
    height: ${({ $minimized }) => ($minimized ? 'auto' : '100%')};
  }
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.brand.primary')};
  flex-shrink: 0;
`;

export const PanelHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const PanelAvatar = styled.div`
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.surface.primary')};
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const PanelHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const PanelBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
`;

export const MessageRow = styled.div<{ $fromUser: boolean }>`
  display: flex;
  justify-content: ${({ $fromUser }) => ($fromUser ? 'flex-end' : 'flex-start')};
`;

export const MessageBubble = styled.div<{ $fromUser: boolean }>`
  max-width: 85%;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${({ $fromUser }) => $fromUser ? tkn('colors.brand.primary') : tkn('colors.surface.primary')};
  border: ${({ $fromUser, theme }) => $fromUser ? 'none' : `0.0625rem solid ${theme.colors.border.primary}`};
  box-shadow: ${tkn('shadows.sm')};
`;

export const PanelFooter = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
`;

export const ConversationButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  padding: ${tkn('spacing.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  cursor: pointer;
  text-align: left;
`;

export const ConversationText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
