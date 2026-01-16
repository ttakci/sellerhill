/**
 * CheckEmailPage Styles
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

  /* Premium background effect consistency */
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
  text-align: center;

  @media (min-width: 768px) {
    padding: ${tkn('spacing.xxxl')};
  }
`;

export const IconCircle = styled.div`
  width: 80px;
  height: 80px;
  margin: 0 auto ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
  background-color: ${tkn('colors.brand.primary')}15;
  color: ${tkn('colors.brand.primary')};
  box-shadow: 0 0 20px ${tkn('colors.brand.primary')}10;
`;

export const DescriptionWrapper = styled.div`
  margin-top: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.xl')};
`;

export const Footer = styled.div`
  margin-top: ${tkn('spacing.xl')};
  padding-top: ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  color: ${tkn('colors.text.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')};
`;

export const TextButton = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.brand.primary')};
  cursor: pointer;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  transition: all ${tkn('transitions.fast')};
  padding: 0;
  
  &:hover:not(:disabled) {
    text-decoration: underline;
    opacity: 0.8;
  }

  &:disabled {
    color: ${tkn('colors.text.disabled')};
    cursor: not-allowed;
  }
`;
