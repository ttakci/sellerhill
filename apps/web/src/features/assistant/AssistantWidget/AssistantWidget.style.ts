/**
 * Assistant sidebar promo + floating chat panel (UI shell; no backend yet).
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/* ─── Sidebar promo card (Sigortam Cepte style) ─── */

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

export const PromoCta = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  width: 100%;
  min-height: 2.5rem;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border: none;
  border-radius: ${tkn('radius.full')};
  cursor: pointer;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  font: inherit;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.sm')};
  transition:
    background ${tkn('transitions.fast')},
    opacity ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const CollapsedOpenButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.5rem;
  padding: ${tkn('spacing.sm')} 0;
  border: none;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  background: ${tkn('colors.sidebar.active')};
  color: ${tkn('colors.sidebar.text')};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }
`;

/* ─── Floating chat panel ─── */

export const PanelRoot = styled.div<{ $minimized: boolean }>`
  position: fixed;
  right: ${tkn('spacing.lg')};
  bottom: ${tkn('spacing.lg')};
  z-index: 1200;
  width: min(22.5rem, calc(100vw - ${tkn('spacing.xl')}));
  height: ${({ $minimized }) => ($minimized ? 'auto' : 'min(32rem, calc(100vh - 6rem))')};
  display: flex;
  flex-direction: column;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.xl')};
  overflow: hidden;

  @media (max-width: 30rem) {
    right: ${tkn('spacing.sm')};
    bottom: ${tkn('spacing.sm')};
    width: calc(100vw - ${tkn('spacing.lg')});
  }
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
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
  border-radius: 50%;
  background: ${tkn('colors.surface.primary')};
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

export const PanelHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  flex-shrink: 0;
`;

export const HeaderIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  background: transparent;
  color: ${tkn('colors.text.inverse')};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
  }
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
  background: ${({ $fromUser }) =>
    $fromUser ? tkn('colors.brand.primary') : tkn('colors.surface.primary')};
  color: ${({ $fromUser }) =>
    $fromUser ? tkn('colors.text.inverse') : tkn('colors.text.primary')};
  border: ${({ $fromUser, theme }) =>
    $fromUser ? 'none' : `0.0625rem solid ${theme.colors.border.primary}`};
  box-shadow: ${tkn('shadows.sm')};
`;

export const PanelFooter = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
  flex-shrink: 0;
`;

export const InputGrow = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SendButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  transition: background ${tkn('transitions.fast')};

  &:hover:not(:disabled) {
    background: ${tkn('colors.brand.primaryHover')};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
