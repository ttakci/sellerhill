/**
 * LoginPage Styles
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
    /* 1024px */
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
    /* 1024px */
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

export const ForgotRow = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: calc(-1 * ${tkn('spacing.sm')});
`;

export const ForgotLink = styled(Button)``;

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

export const GoogleButtonRow = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const OrDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${tkn('colors.border.primary')};
  }
`;
