/**
 * VerifyEmailPage Styles
 */

import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.background.secondary};
`;

export const Card = styled.div`
  width: 100%;
  max-width: 450px;
  padding: ${({ theme }) => theme.spacing.xxl};
  background: ${({ theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

export const IconWrapper = styled.div<{ success?: boolean; error?: boolean }>`
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme, success, error }) => 
    success ? theme.colors.semantic.success + '20' : 
    error ? theme.colors.semantic.error + '20' : 
    theme.colors.brand.primary + '20'};
  color: ${({ theme, success, error }) => 
    success ? theme.colors.semantic.success : 
    error ? theme.colors.semantic.error : 
    theme.colors.brand.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }) => theme.spacing.md};
`;

export const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
`;

export const Description = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.md};
  margin: 0;
`;

export const Footer = styled.div`
  margin-top: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
