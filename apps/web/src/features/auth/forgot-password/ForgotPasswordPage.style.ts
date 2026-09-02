/**
 * ForgotPasswordPage Styles
 *
 * Two-panel layout — the shared AuthShowcase on the left, the request form (or,
 * once submitted, a "check your email" confirmation panel) on the right.
 * Mirrors LoginPage / CheckEmailPage.
 */

import styled from '@emotion/styled';
import { Button, tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: ${tkn('colors.background.primary')};
  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
`;

export const LayoutWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  flex-wrap: wrap;

  @media (min-width: ${tkn('breakpoints.lg')}) {
    flex-wrap: nowrap;
  }
`;

export const FormPanel = styled.div`
  flex: 1 1 100%;
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  overflow-y: auto;
  z-index: 1;

  @media (min-width: ${tkn('breakpoints.lg')}) {
    flex: 0 0 36%;
    width: 36%;
    padding: ${tkn('spacing.xl')};
  }
`;

export const AuthCard = styled.div`
  width: 100%;
  max-width: 25rem; /* 400px */
  background: ${tkn('colors.surface.primary')};
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const ButtonContainer = styled.div`
  margin-top: ${tkn('spacing.md')};
`;

export const Footer = styled.div`
  margin-top: ${tkn('spacing.lg')};
  text-align: center;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  justify-content: center;
`;

export const FooterLink = styled(Button)``;

/* --- Confirmation panel (after a request is accepted) --- */

export const ConfirmCard = styled.div`
  width: 100%;
  max-width: 25rem; /* 400px */
  background: ${tkn('colors.surface.primary')};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const IconContainer = styled.div`
  width: 5.5rem; /* 88px */
  height: 5.5rem;
  background-color: ${tkn('colors.semanticTint.info')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')};
  color: ${tkn('colors.semantic.info')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
  margin-bottom: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.sm')}) {
    width: 4rem;
    height: 4rem;
    margin-bottom: ${tkn('spacing.lg')};
  }
`;

export const ConfirmHeader = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  align-items: center;
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 20rem; /* 320px */
`;

export const ResendRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.lg')};
`;

export const ResendButton = styled(Button)`
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  min-width: auto;
`;
