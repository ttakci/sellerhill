/**
 * LoginPage Styles
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  padding: ${tkn('spacing.md')};
  position: relative;
  overflow: hidden;

  /* Premium background effect */
  &::before {
    content: '';
    position: absolute;
    top: -10%;
    right: -10%;
    width: 40%;
    height: 40%;
    background: radial-gradient(circle, ${tkn('colors.brand.primary')}15 0%, transparent 70%);
    filter: blur(60px);
    z-index: 0;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -10%;
    left: -10%;
    width: 40%;
    height: 40%;
    background: radial-gradient(circle, ${tkn('colors.brand.primary')}10 0%, transparent 70%);
    filter: blur(60px);
    z-index: 0;
  }
`;

export const AuthCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.xl')};
  box-shadow: ${tkn('shadows.xl')};
  border: 1px solid ${tkn('colors.border.primary')};
  padding: ${tkn('spacing.xl')};
  width: 100%;
  max-width: 480px;
  position: relative;
  z-index: 1;
  transition: transform ${tkn('transitions.normal')}, box-shadow ${tkn('transitions.normal')};

  @media (min-width: 768px) {
    padding: ${tkn('spacing.xxxl')};
  }

  &:hover {
    box-shadow: ${tkn('shadows.xl')};
  }
`;

export const LogoWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: ${tkn('spacing.xl')};
`;

export const LogoIcon = styled.div`
  width: 48px;
  height: 48px;
  background: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.lg')};
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: ${tkn('shadows.md')};
  color: ${tkn('colors.text.inverse')};
  margin-bottom: ${tkn('spacing.md')};
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const SubtitleWrapper = styled.div`
  margin-top: ${tkn('spacing.xs')};
`;

export const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const ButtonContainer = styled.div`
  margin-top: ${tkn('spacing.lg')};
`;

export const Footer = styled.div`
  text-align: center;
  margin-top: ${tkn('spacing.xl')};
  padding-top: ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.brand.primary')};
  cursor: pointer;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.sm')};
  transition: all ${tkn('transitions.fast')};
  padding: 0;
  
  &:hover {
    color: ${tkn('colors.brand.primaryHover')};
    text-decoration: underline;
  }
`;
