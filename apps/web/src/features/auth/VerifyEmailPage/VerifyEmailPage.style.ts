/**
 * VerifyEmailPage Styles
 */

import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
  background: ${({ theme }: { theme: Theme }) => theme.colors.background.secondary};
`;

export const Card = styled.div`
  width: 100%;
  max-width: 450px;
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xxl};
  background: ${({ theme }: { theme: Theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.lg};
  box-shadow: ${({ theme }: { theme: Theme }) => theme.shadows.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.lg};
  text-align: center;
`;

export const IconWrapper = styled.div<{ success?: boolean; error?: boolean }>`
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.full};
  background: ${({ theme, success, error }: { theme: Theme; success?: boolean; error?: boolean }) => 
    success ? theme.colors.semantic.success + '20' : 
    error ? theme.colors.semantic.error + '20' : 
    theme.colors.brand.primary + '20'};
  color: ${({ theme, success, error }: { theme: Theme; success?: boolean; error?: boolean }) => 
    success ? theme.colors.semantic.success : 
    error ? theme.colors.semantic.error : 
    theme.colors.brand.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;

export const Title = styled.h1`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.xxl};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0;
`;

export const Description = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.md};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }: { theme: Theme }) => theme.typography.lineHeight.normal};
  margin: 0;
`;

export const Footer = styled.div`
  margin-top: ${({ theme }: { theme: Theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.md};
`;
